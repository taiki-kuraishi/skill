---
name: review-inbox
description: "このリポジトリで常駐する root session が、他のリポジトリの Crit review が approve されたときに crit のフックから intercom で届く通知を受け、root 自身が default branch の上で skill-from-review を回し、commit・push まで行う運用手順。常駐 root の起動・セットアップ、フックの通知（skill://review-inbox を読むよう求める message）を受けたときに使用する。"
metadata:
  internal: true
---

# review-inbox

他のリポジトリの Crit review が approve されると、`scripts/on_finish_approved.sh`（crit の global フック）がコメントを保存し、名前が `review-inbox` の omp session に保存先を intercom で送る。その session（root）は子を起動せず、review を 1 件ずつ自分で処理する。repo 本体の checkout の default branch のまま `skill-from-review` を回し、default branch に commit・push する。

## セットアップ（マシンごとに 1 回）

環境変数 `KSTACK_SKILL_REPO` にこの repo の checkout の絶対 path を設定し、`~/.crit.config.json` の `hooks` にフックを書く（他のキーは消さない）。

```json
{
  "hooks": {
    "on_finish_approved": "inline:exec \"$KSTACK_SKILL_REPO/.agents/skills/review-inbox/scripts/on_finish_approved.sh\""
  }
}
```

- crit はフックを、crit を起動した agent の env で動かす。`KSTACK_SKILL_REPO` が無い agent から approve すると、フックは exit 127 で失敗し、指摘も保存されない。login shell で読まれる場所に設定し、設定より前に起動した agent と crit は起動し直す
- 設定できたかは、crit を起動する agent の shell で `test -x "$KSTACK_SKILL_REPO/.agents/skills/review-inbox/scripts/on_finish_approved.sh"` と `jq -e '.hooks.on_finish_approved' ~/.crit.config.json` の両方が通ることで確かめる
- 通知先は profile 間で共通の `~/.pi/agent` に固定する。フック内で `PI_CODING_AGENT_DIR` を切り替えるので、approve 元の agent の profile はそのままでよい
- `~/.pi/agent/intercom/config.json` に `busyDelivery` を `"human-first"` で足す（他のキーは消さない）。既定の `steer` だと、前の review を処理している最中の turn に次の通知が割り込む
- フックは `jq`・`git`・`node`（`~/.omp/plugins/node_modules/.bin/pi-intercom` は `node` で動く）を使う。crit の daemon の PATH に `jq` か `git` が無いと保存もされず、`node` が無いと保存だけされて通知が届かない

## 常駐 root を起動する

1. 端末（herdr か Tern）の中で、repo 本体の checkout の default branch に、profile を指定せず `PI_CODING_AGENT_DIR="$HOME/.pi/agent" omp` で root を起動し、`/skill:review-inbox` で始める。どちらの端末でもなければ root 自身に名前を付けられないので、user に伝えて止まる
2. 導入済みの `kstack-handoff` の `SKILL.md` を読み、手順 1「確かめる」で root の端末（pane か block）を同定し、checkout と default branch を控える。参照ファイルは handoff 本文の案内に従って読む。子は起動しないので、handoff の「起動」以降は使わない
3. intercom の名前を `review-inbox` に固定する。tool から slash command は直接実行できないので、handoff 本文から読んだ参照ファイルの「名前を付ける」で、root 自身（同定済みの pane か block）に `/alias review-inbox` を送る。その後 `intercom({ action: "list" })` で、`review-inbox` が自分 1 つだけであることを確かめる
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
2. default branch にいて、未 commit の変更が無いことを `git status --short` で確かめ、`git pull --ff-only` で最新にする。変更が残っているか fast-forward できなければ、状態を添えて user に伝えて止まる
3. `skill://skill-from-review` を読み、保存した JSON を入力として手順を最後まで回す。分類案と、追記か新規作成かの案は、書く前に root がチャットで 1 問ずつ（分類案と対象の指摘を添えて）user に示し、承認されなかった指摘は SKILL 化しない
4. skill-from-review の手順 7 で user が Crit で approve したら、下の「承認から push まで」に従う

前の review を処理している間に届いた通知は、`busyDelivery` により今の turn が終わるまで待たされる。review は届いた順に 1 件ずつ、push まで終えてから次に進む。

```text
Bad: 前の review の差分が未 commit のまま、次の review の SKILL を書き始める
Good: 前の review を push まで終え、git status が空の default branch から次の review を始める
```

なぜ: すべての review が同じ checkout の default branch を使うので、差分が混ざると review ごとの承認範囲と commit が切り分けられなくなる。

## 承認から push まで

review-inbox では、user が Crit で approve したことを、default branch への commit と push までの user の明示指示として扱う。PR は作らない。root は承認を受けたら確認を挟まず、次を続けて行う。

- commit（`skill://kstack-git` の「commit の書き方」）。その review で書いた変更だけを含める
- default branch への push（`git push origin HEAD`）。non-fast-forward で拒否されたら `git pull --rebase` で取り込む。衝突したら解かずに止まり、状態を添えて user に聞く
- push した commit の CI の監視（`skill://kstack-git` の「push した commit の CI を完了まで監視する」）。結果と実行 URL を user に報告する

承認の後に足した差分（漏れの補足、CI の失敗の修正など）は、この指示に含まれない。Crit で user に再 review を依頼し、approve を受けてから同じ流れで commit・push する。

```text
Bad: approve の後に「commit・push しますか」と user に聞く / topic branch を切って PR を作る / 承認後に足した差分をそのまま push する
Good: approve を受けたら default branch に commit・push して CI を見届け、承認後に足した差分は Crit で再 review の approve を受けてから同じ流れで進める
```

なぜ: review-inbox が扱うのはこの skill repo の SKILL で、user は Crit の approve で中身を確かめ終えている。毎回 push を聞いたり PR を挟んだりすると往復が増えるだけ。default branch に直接載るので、壊れていないかは push 後の CI で確かめる。
