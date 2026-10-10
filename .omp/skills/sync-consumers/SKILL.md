---
name: sync-consumers
description: "この SKILL 配布リポジトリの main に push した後、取り込んでいる利用先 repo（ax など）の kstack-* SKILL を上流の最新に追従させる手順。user の承認を取ってから、利用先で worktree を切って skills CLI で更新し、PR を作り、CI が通ったら merge する。SKILL を更新して push したとき、利用先にも反映・pull・同期したいと言われたときに使用すること。"
metadata:
  internal: true
---

# sync-consumers

この repo の `skills/kstack/` を更新して `main` に push した後、それを取り込んでいる利用先 repo を上流の最新に追従させる。利用先ごとに worktree で更新し、1 PR にして CI を通してから merge する。

## 利用先

| repo                    | 本体の checkout                                    | 更新手順                                                                  |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| `fancs-product-mgmt/ax` | `~/Documents/ghq/github.com/fancs-product-mgmt/ax` | ax の `.claude/rules/skills.md` の「`kstack-*`: `skills` CLI で管理する」 |

更新のコマンドと注意（実行場所、同名 SKILL の上書き、telemetry）は利用先の文書が正。ここに写さず、毎回そこを読む。利用先が増えたら行を足す。

## 手順

1. **push を確かめる** — この repo で `git fetch origin` し、`git status -sb` で `main` が `origin/main` より先行していないこと、`git rev-parse --short origin/main` を控える。先行していたら push を頼んで止まる。完了条件: 利用先に反映する上流の commit が決まっている
2. **承認を取る** — 利用先ごとに「上流の commit・worktree で更新・PR 作成・CI が通ったら squash merge」を示し、進めてよいか user に聞いて止まる。承認された利用先だけを進める。完了条件: 進める利用先が user に承認されている
3. **worktree を切る** — 利用先の本体の checkout で `git fetch --prune origin` し、次で worktree を作る。stdout の JSON の `.path` を控え、そこで `bun install --frozen-lockfile` する。完了条件: worktree で利用先の skills CLI と git hook が動く

   ```bash
   wt -C <本体の checkout> switch --create skills/sync-<上流の commit> --base origin/<default branch> --no-cd --no-hooks --format json
   ```

4. **更新する** — worktree で利用先の更新手順を読み、lock 済みの SKILL の更新と、上流に増えた SKILL の追加を行う。skills CLI は環境の `GH_TOKEN` で上流を取りに行き、利用先の org 用の token では private の上流を読めず `Failed to update` になるので、CLI の実行にだけ上流のアカウントの token を渡す（`T=$(gh auth token --user taiki-kuraishi); GITHUB_TOKEN=$T GH_TOKEN=$T bun x skills …`）。上流に増えた SKILL と消えた SKILL は、`skills add <上流> --list` の名前と `skills-lock.json` の keys を比べて見つける（`--list` は `--json` と併用できない）。消えた・名前が変わった SKILL が lock に残っていたら、消さずに user に報告する。`git status --short` が空なら、worktree を片付けて「差分なし」と報告し、その利用先は終える。完了条件: 差分が上流の SKILL の更新だけで、lock と実体が同じ commit に入る
5. **PR を merge する** — 利用先の `git log --oneline -10` の書き方で 1 commit にし（例: `📝 docs: sync kstack skills to taiki-kuraishi/skill@<上流の commit>`）、`git push -u origin <branch>`、`gh pr create --base <default branch>` で PR を作る。本文には上流の commit と更新・追加した SKILL を書く。続けて `gh pr merge <PR の URL> --squash --auto` で、CI が通ったら merge されるよう予約する。CI の間に default branch が進むと「base と最新でない」で merge されないので、`gh pr view <PR の URL> --json mergeStateStatus` が `BEHIND` なら `gh pr update-branch <PR の URL>` する（SKILL の中身は変わらず、CI だけ回り直す）。commit・push の hook と CI は数分〜十数分かかるので、background job で `gh pr checks <PR の URL> --watch` を待ち、`state` が `MERGED` になるのを確かめる。hook・CI が落ちたら直さずに、原因と worktree を user に報告して止まる。完了条件: PR が merge された
6. **片付ける** — `wt -C <本体の checkout> remove skills/sync-<上流の commit> --foreground` で worktree と branch を消す。本体の checkout は fetch 以外触らない。PR の URL と merge commit を user に報告する。完了条件: worktree・branch が残らず、利用先ごとの結果を報告した

```text
Bad: 利用先の本体の checkout で branch を切り替えて skills update する / wt の hook をそのまま走らせる
Good: --no-hooks の worktree で bun install だけして更新し、本体の checkout は fetch だけにする
```

なぜ: 利用先の本体の checkout は、別の session が default branch のまま使っていて、未コミットの作業もある。利用先の worktree の hook は SKILL の更新に要らない install（鍵や認証が要るもの）まで走らせ、遅く失敗しやすい。skills CLI の版と commit 時の hook は利用先の依存で動くので、`bun install` は省かない。

```text
Bad: 承認の前に push・PR を作る / CI の失敗を自分で直して push し直す
Good: 承認を取ってから 1 回だけ push し、落ちたら報告して止まる
```

なぜ: push のたびに利用先の hook と CI が回り、時間とコストがかかる。CI を通すための修正は上流の SKILL の更新ではないので、何を直すかは user が決める。
