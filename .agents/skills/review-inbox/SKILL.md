---
name: review-inbox
description: "このリポジトリで常駐する root session が、他のリポジトリの Crit review が approve されたときに crit のフックから intercom で届く通知を受け、review ごとに kstack-handoff で子 session を起動して skill-from-review を回させる運用手順。常駐 root の起動・セットアップ、フックの通知（skill://review-inbox を読むよう求める message）を受けたときに使用する。"
metadata:
  internal: true
---

# review-inbox

他のリポジトリの Crit review が approve されると、`scripts/on_finish_approved.sh`（crit の global フック）がコメントを保存し、名前が `review-inbox` の omp session に保存先を intercom で送る。その session（root）は review ごとに子を 1 つ起動し、子が `skill-from-review` を回す。root は振り分けと、user との窓口だけを持つ。

## セットアップ（マシンごとに 1 回）

この repo の checkout で実行する。別の repo で実行すると、リンク先の無い symlink ができ、crit はフックを見つけられない。

```bash
mkdir -p ~/.crit/hooks
ln -s "$(git rev-parse --show-toplevel)/.agents/skills/review-inbox/scripts/on_finish_approved.sh" ~/.crit/hooks/on_finish_approved.sh
test -x ~/.crit/hooks/on_finish_approved.sh
```

- `~/.pi/agent/intercom/config.json` に `busyDelivery` を `"human-first"` で足す（他のキーは消さない）。既定の `steer` だと、子を監督している最中の turn に通知が割り込む
- フックは `jq`・`git`・`node`（`~/.omp/plugins/node_modules/.bin/pi-intercom` は `node` で動く）を使う。crit の daemon の PATH に `jq` か `git` が無いと保存もされず、`node` が無いと保存だけされて通知が届かない

## 常駐 root を起動する

1. herdr の中で、repo 本体の checkout の default branch に omp を起動し、`/skill:review-inbox` で始める
2. `skill://kstack-handoff` の手順 1「確かめる」を行い、root の `Session ID`・checkout・default branch を控える
3. `/alias review-inbox` で intercom の名前を固定する。`intercom({ action: "list" })` で、`review-inbox` が自分 1 つだけであることを確かめる
4. turn を終えて通知を待つ

フックは名前が `review-inbox` の session がちょうど 1 つのときだけ送る。0 個や 2 個以上なら送らず、保存だけして終わる。

```text
Bad: 名前を付けずに待つ / 2 つ目の root にも /alias review-inbox を付ける
Good: root 1 つだけに /alias review-inbox を付け、list で 1 件であることを確かめる
```

なぜ: 名前の無い root は、同じ cwd で動く subagent と区別できない。同じ名前が 2 つあると、どちらにも届かない。

## 通知を受ける

通知の本文は「crit の review が approve されました。skill://review-inbox を読み、`<保存した JSON の path>` を処理してください」の形で、`From pi-intercom-cli` として届く。user の発言ではない。

1. 保存した JSON の `repo_root` と `comments_json` の件数を確かめる。読めないときは、path を添えて user に伝えて止まる
2. `skill://kstack-handoff` の「起動」で、子を 1 つ起動する。`<feature>` は `review`、`<task>` は JSON の `session_key` にする（例: branch `ho/review/23bd52db9a3a`）。同じ branch が既にあれば（`git branch --list 'ho/review/*'`）、連番を足す（例: `ho/review/23bd52db9a3a-2`）
3. 引き継ぎ prompt は下の形にし、後ろに kstack-handoff の「子との取り決め」を足す
4. 以降は kstack-handoff の「子に応える」と「統合」に従う。子が送る分類案は、root が ask tool で user に示し、回答を reply で子に返す。user が Crit で approve したら、「統合」の手順 2 ではなく、下の「承認から merge まで」に従う。PR の衝突だけは、「統合」の「止まって user に聞く」ではなく、下の「共有ファイルの衝突」に従う

```md
`<保存した JSON の path>` は、`<repo_root>` の Crit review の approve 時のコメントです。`skill://skill-from-review` を読み、その手順を最後まで回してください。

- 手順 1・2 の分類と、追記か新規作成かの案ができたら、書く前に `intercom({ action: "ask" })` で root に送り、user の承認を待つ。承認されなかった指摘は SKILL 化しない
- skill-from-review の中で user に聞くこと（テストを回すか、など）は、ask tool ではなく root に ask する
- 手順 7 の user review は自分で依頼せず、完了報告として root に送る
```

review が続けて届いたら、前の子を待たずに、review ごとに子を起動する。

## 承認から merge まで

review-inbox では、user が Crit で approve したことを、push・PR 作成・merge までの user の明示指示として扱う。root は承認を受けたら、kstack-handoff の「統合」の手順 2（push・PR・merge を user に確かめる）を省き、子に次をまとめて指示する。

- commit（`skill://kstack-git` の「commit の書き方」）
- push と PR 作成（`skill://kstack-git` の「PR の作り方」。subagent の確認を含む）
- merge（`skill://kstack-git` の「PR を merge する」で CI と GitHub の approve を確かめる。揃わなければ merge せず root に返す）

merge できずに返ったときと、merge 後の片付けは、kstack-handoff の「統合」に従う。承認の後に子が足した差分（漏れの補足、衝突の解消など）は、この指示に含まれない。root が Crit で user に再 review を依頼し、approve を受けてから同じ流れで進める。

```text
Bad: approve の後に「push・PR・merge のどれを行いますか」と user に聞く / 承認後に子が足した差分をそのまま merge させる
Good: approve を受けたら commit から merge までを子にまとめて指示し、承認後に足した差分は Crit で再 review の approve を受けてから同じ流れで進める
```

なぜ: review-inbox が扱うのはこの skill repo の SKILL で、repo は merge 前の approve を求めない。user は Crit の approve で中身を確かめ終えていて、毎回 merge を聞くと往復が増えるだけ。merge の前提（CI・GitHub の approve）は kstack-git の手順が確かめる。

## 共有ファイルの衝突

並列の子は、`skills/kstack/kstack-skill-review/SKILL.md` の一覧、linter package の設定と README、同じ `kstack-*` の SKILL を同時に書き換えうる。`kstack-interface-first-development` の「1 ファイルは 1 フェーズだけが担当する」とは違い、ここでは衝突を merge のときに解く。

- 先に承認された子から統合する。後の子の PR が衝突したら、root がその子に「`origin/<default branch>` を取り込み、衝突を解いて、解いた差分を報告して」と send する
- 解いた差分は、承認後の未 review の変更として扱う。root が user に再 review を依頼してから merge させる

```text
Bad: 衝突を子に解かせ、そのまま merge させる
Good: 解いた差分を root が受け取り、kstack-review-request で user に再 review を依頼してから merge させる
```

なぜ: review は散発的に届くので、前の子の merge を待つと指摘がたまる。一方で、衝突の解き方で既存の規約が消えうるので、解いた結果は user が確かめる。
