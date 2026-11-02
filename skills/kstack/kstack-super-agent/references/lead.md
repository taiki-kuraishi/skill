# lead の手順

この文書は、`kstack-super-agent` の router が `start` で起動した非対話の lead が読む。lead の画面は誰も見ていない。user に届くのは `report` で台帳に書いた内容だけで、user の答えは router から intercom で届く。

## 進め方

`skill://kstack-root-driven-development` に従って、引き継ぎ prompt の依頼を進める。root-driven で root が user と話す箇所は、すべて下の「user と話す」に置き換える。それ以外（subagent への委譲、手順 5 の review、検証の分担、既存パターンから外れる実装の事前承認、承認後の commit）は root-driven のとおりに行う。

## user と話す

user への質問・承認の依頼は、`report` で 1 回に 1 問だけ出し、turn を終える。

```bash
bun <script> report --feature <feature> --state <state> --summary "<user が読む本文>" --ask "<質問 1 つ>"
```

- 実行する cwd は自分の worktree にする。台帳は cwd の repo から決まる
- `--summary` と `--ask` には、root-driven が user への質問に求める背景・判断材料・選択肢・おすすめを書く。router はコードを読まず、この文面をそのまま user に見せる。前の report を参照するだけの書き方（「先ほどの件」）にしない
- 答えを求めない報告は `--ask` を付けない。root-driven の手順 3 のフェーズ設計は `planning` で通知し、回答を待たずに実装へ進む。未承認の範囲変更・既存パターンから外れる実装や user にしか決められない未決事項があれば、質問して止まる
- 答えは `[superagent] <feature> の質問 qN への user の回答:` で始まる intercom で届く。届くまで turn を終えて待つ。sleep や intercom の ask で待たない
- 「router … に届きませんでした。台帳には記録済みです」で終了コード 1 になったら、再送せずに turn を終える。router が台帳から拾い直す。それ以外の終了コード 1（usage・台帳が無い・lead の行が無い）は台帳に残らず router も気づけないので、`--feature`・`--state`・cwd を引き継ぎ prompt と突き合わせてから 1 度だけ送り直す
- omp の ask tool や、user に直接見せる tool は使わない

`--state` は今いる段階を 1 つ選ぶ。

| state          | 使う場面                                                       |
| -------------- | -------------------------------------------------------------- |
| `planning`     | 要件・やることの合意を求める、または決定したフェーズを通知する |
| `implementing` | 実装中に、既存パターンから外れる実装の承認などを求める         |
| `review`       | Crit の user review を依頼する                                 |
| `blocked`      | 自分では進められない（下の「止まる」）                         |
| `done`         | フェーズを commit し終え、この ticket を閉じる                 |

## user review

Crit の窓口は lead 自身が持つ。`skill://kstack-review-request` に従って自分の worktree を cwd に Crit を background job で起動し、`REVIEW_URL` と `できるようになったこと / 変更ファイル / 検証と証拠 / 未解決事項` を `--state review` の `--summary` に書いて report する。Finish Review の結果は job の終了として自分に届く。指摘への返信と再レビューも自分で行い、再依頼のたびに report する。

UI が変わるフェーズは、root-driven の手順 6 のとおりコードの review の前に live review を回す。dev server を background job で起動し、`kstack-review-request` の「live review で起動する」の URL を同じ形で report する。

push・PR・merge は承認から推測せず、`--ask` で 1 問ずつ許可を求める。

## 1 ticket は 1 フェーズまで

承認されたフェーズを commit したら、次のフェーズを切り出さずに止まる。一覧に残りがあれば、残りの一覧を `--summary` に書き、`--state done --ask "残りを新しい ticket として始めますか？"` で report して turn を終える。答えが来ても次のフェーズには進まない。router が新しい lead を起動する。

なぜ: 1 つの lead が複数のフェーズを抱えると context が溢れ、compaction で経緯を失う。フェーズの区切りは承認と commit が済んでいて、引き継ぎに必要な状態がすべて repo と台帳にある。

## 止まる

次のときは作業を止め、`--state blocked` で何が足りないかを 1 問にして report する。

- 依頼の範囲を超える変更が要る
- 必要な MCP のデバイス（`xd://mcp__...`）が無い。profile 名と server 名を書き、その profile の TUI でログインしてもらうよう頼む
- 検証や作業に、user にしかできない操作が要る

## 引き継ぎ prompt の形

router は `start --prompt` に次の形のファイルを渡す。

```text
あなたは kstack-super-agent の lead です。<この lead.md の絶対パス> を読んで従ってください。
- feature: <feature>
- worktree: <worktree の絶対パス>
- script: <superagent.ts の絶対パス>
- 依頼（user の言葉のまま）:
<依頼文>
```
