---
name: kstack-super-agent
description: user が注意を払う session を常駐の router 1 つにし、feature ごとに非対話の lead（root-driven で進める omp）を起動して並行させ、lead の質問・review 依頼・許可の求めを台帳経由で user に中継する開発フロー
disable-model-invocation: true
---

# kstack-super-agent

この session は router として常駐し、user と話す唯一の窓口になる。feature ごとの実装は、worktree で非対話に動く lead が `kstack-root-driven-development` の手順で進める。router はコードを読まず、lead が書いた文面をそのまま user に見せ、user の答えをそのまま lead に返す。状態は repo の外の台帳に置くので、router は compaction の後や `/new` の後も台帳から続きを再開できる。

## 責務

| 担当   | 責務                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| router | user との会話、lead の起動・一覧・停止、lead の報告と質問の中継、user の答えの配送                                                   |
| lead   | 要件・計画・質問の作成、実装、検証の委譲、Crit の user review、承認後の commit、push・PR・merge の許可の求め（`references/lead.md`） |
| user   | lead の質問への回答、Crit での review と承認、push・PR・merge の許可、新しい ticket の開始の判断                                     |

router はコードを読まず、検証も設計の議論もしない。読むと、並行する feature の数だけ context が膨らみ、compaction で経緯を失う。user が「なぜ？」と聞いたら、その問いを lead に返す。

## 道具

lead の起動・停止と台帳への書き込みは、すべて `scripts/superagent.ts` を通す。読み出しは `list` と台帳のファイルを直接読む。`<script>` はこの SKILL のディレクトリの `scripts/superagent.ts` の絶対パスを指す。

| コマンド                                                           | 使う人 | 内容                                                                       |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| `bun <script> start --feature <f> --worktree <wt> --prompt <file>` | router | lead `lead-<f>` を非対話で起動し、台帳に記録する                           |
| `bun <script> list`                                                | router | cwd の repo の全 feature の state・未回答の質問・lead の status を表で出す |
| `bun <script> stop --feature <f>`                                  | router | lead をプロセスグループごと止める                                          |
| `bun <script> reply --ledger <file> --to <qN> --text <答え>`       | router | user の答えを lead に送る                                                  |
| `bun <script> report ...`                                          | lead   | 報告と質問を router に送る                                                 |

台帳は `~/.superagent/state/<main checkout のパスの / を - にした文字列>/<feature>.md` にある。lead の profile は worktree の direnv（`OMP_PROFILE`）で決まり、スクリプトが宛先の profile に合わせて intercom を送る。台帳に直接書き込まない。書き込みは送信と一体でスクリプトが行い、手で書くと配送の記録と食い違う。

## Workflow

1. **router として立つ**
   - repo の main checkout を cwd にして起動する。`/alias superagent` で intercom 名を固定し、intercom の list で `superagent` が自分 1 つだけであることを確かめる。0 件・2 件では lead の report が届かない。`/new` で交代した後も同じ名前を名乗る
   - `bun <script> list` を実行し、台帳を読み直す。未回答の質問と `review` の feature があれば、下の 3 の形で user に出し直す

2. **feature を始める**
   - user の依頼から feature 名（kebab-case）を決め、`wt -C <main checkout> switch --create sa/<feature> --no-cd --format json` で worktree を作る。前の ticket の続きなら `--base sa/<前の feature>` を足す。前の ticket の commit は push・merge の指示があるまで前の branch にしか無い
   - `references/lead.md` の「引き継ぎ prompt の形」で prompt ファイルを書き、依頼は user の言葉のまま入れる
   - wt の出力の `.path` を `--worktree` に渡して `start` で起動し、feature 名と worktree を user に 1 行で伝えて turn を終える。lead の報告は intercom で届く

3. **報告を中継する**
   - `[superagent] <feature> state=<state>: ...` で始まる intercom が届いたら、feature・state・本文・質問を、lead の文面のまま user に見せる。要約・言い換え・補足をしない。伝言で意味がずれると、user は lead が問うていない問いに答えることになる
   - 質問が複数の feature から溜まっていても、1 回の返答で出すのは 1 問にする。残りは答えを受けてから出す
   - `review` の報告にある `REVIEW_URL` はそのまま渡す。Crit は lead が持ち、結果も lead に届くので、router は承認を待たない

4. **答えを返す**
   - user の答えを、言い換えずに `bun <script> reply --ledger <台帳> --to <qN> --text <答え>` で送る。台帳は報告の末尾の `台帳:` の行にある。どの質問への答えか曖昧なら、送る前に user に確かめる
   - 終了コード 1 の「作業中か不在のため未配送」は、lead が受け取れなかったことを示す。user に伝え、`list` で lead が `idle` になれば同じ `reply` を送り直す。`absent`・`unknown` のままなら lead は落ちているので、user に伝えて `stop` し、続けるなら 2 から起動し直す

5. **ticket を閉じる・続ける**
   - lead は承認された 1 フェーズを commit すると `done` を報告して止まる。この質問にも user の答えを `reply` で送り、台帳の質問を閉じてから `stop` で lead を止める（lead は答えを受けても次のフェーズに進まない）。user が残りを続けると答えたら、残りを依頼として 2 から新しい feature を始める
   - lead が起動した Crit の daemon は lead とは別のプロセスグループで動き、`stop` では止まらない。`stop` の後、`~/.crit/sessions/<id>.json` のうち `cwd` がその worktree のものだけを、その `pid` で止める（`crit status --json` には cwd が無い）
   - user に頼まれたら `list`・`stop` を実行して結果を見せる。worktree の削除と push・PR・merge の実行は、user の明示の指示があるまで行わない

## 状態を失ったとき

compaction の後、`/new` の後、何を待っているか曖昧になったときは、記憶で答えずに `list` と台帳を読み直す。台帳が正で、router の会話の記憶はその写しに過ぎない。

## Red flags

| 誘惑                                                         | このフローの判断                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 「lead の質問を分かりやすく言い換えて出す」                  | そのまま出す。言い換えは lead の判断材料を落とす                                           |
| 「設計の質問なので router がコードを読んで答えを補う」       | 読まない。user の問いを lead に返す                                                        |
| 「lead が作業中で reply が届かないので intercom で直接送る」 | 直接送らない。作業中の非対話 session は intercom を捨てる。`idle` を待って `reply` し直す  |
| 「lead が止まっていそうなので kill して起動し直す」          | `stop` してから `start` する。kill だけでは台帳と pgid が食い違い、同名の lead が 2 つ残る |
