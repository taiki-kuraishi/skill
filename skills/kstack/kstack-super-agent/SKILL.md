---
name: kstack-super-agent
description: user が注意を払う session を常駐の router 1 つにし、feature ごとに非対話の lead（root-driven で進める omp）を起動して並行させ、質問・review 依頼・許可の求めを台帳経由で中継する開発フロー。review-inbox の Crit approve 通知から指摘を SKILL にする lead も起動する
disable-model-invocation: true
---

# kstack-super-agent

この session は router として常駐し、user と話す唯一の窓口になる。feature ごとの実装は、worktree で非対話に動く lead が `kstack-root-driven-development` の手順で進める。router はコードを読まず、lead が書いた文面をそのまま user に見せ、user の答えをそのまま lead に返す。状態は repo の外の台帳に置くので、router は compaction の後や `/new` の後も台帳から続きを再開できる。

## 責務

| 担当   | 責務                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| router | user との会話、lead の起動・一覧・停止、lead の報告と質問の中継、user の答えの配送                  |
| lead   | 要件・計画・質問の作成、実装、検証の委譲、Crit の user review、承認後の操作（`references/lead.md`） |
| user   | lead の質問への回答、Crit での review と承認、許可が必要な操作と新しい ticket の開始の判断          |

router はコードを読まず、検証も設計の議論もしない。読むと、並行する feature の数だけ context が膨らみ、compaction で経緯を失う。user が「なぜ？」と聞いたら、その問いを lead に返す。

## 道具

lead の起動・停止と台帳への書き込みは、すべて `scripts/superagent.ts` を通す。読み出しは `list` と台帳のファイルを直接読む。`<script>` はこの SKILL のディレクトリの `scripts/superagent.ts` の絶対パスを指す。

| コマンド                                                           | 使う人 | 内容                                                                       |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| `bun <script> start --feature <f> --worktree <wt> --prompt <file>` | router | lead `lead-<f>-<repo ごとのハッシュ>` を非対話で起動し、台帳に記録する     |
| `bun <script> list`                                                | router | cwd の repo の全 feature の state・未回答の質問・lead の status を表で出す |
| `bun <script> stop --feature <f>`                                  | router | lead をプロセスグループごと止める                                          |
| `bun <script> reply --ledger <file> --to <qN> --text <答え>`       | router | user の答えを lead に送る                                                  |
| `bun <script> report ...`                                          | lead   | 報告と質問を router に送る                                                 |

台帳は `~/.superagent/state/<main checkout のパスの / を - にした文字列>/<feature>.md` にある。lead の profile は worktree の direnv（`OMP_PROFILE`）で決まり、スクリプトが宛先の profile に合わせて intercom を送る。台帳に直接書き込まない。書き込みは送信と一体でスクリプトが行い、手で書くと配送の記録と食い違う。

## Workflow

1. **router として立つ**
   - repo の main checkout を cwd にして起動する。`/alias superagent` で intercom 名を固定し、intercom の list で `superagent` が自分 1 つだけであることを確かめる。0 件・2 件では lead の report が届かない。`/new` で交代した後も同じ名前を名乗る。review-inbox を受ける場合は `$KSTACK_SKILL_REPO/.agents/skills/review-inbox/SKILL.md` のセットアップを読み、全 profile を横断して router を 1 つにする（自分の broker の list だけでは他 profile の重複は分からない）
   - `bun <script> list` を実行し、台帳を読み直す。`KSTACK_SKILL_REPO` が設定されていれば、cwd をその main checkout にした `list` でも skill repo の台帳を読む。未回答の質問と `review` の feature があれば、下の 3 の形で user に出し直す

2. **feature を始める**
   - user の依頼から feature 名（kebab-case）を決め、`wt -C <main checkout> switch --create sa/<feature> --no-cd --format json` で worktree を作る。前の ticket の未 merge の commit を引き継ぐときだけ `--base sa/<前の feature>` を足す。merge 済みの続きは、fetch した最新の default branch を `--base` にする
   - `references/lead.md` の「引き継ぎ prompt の形」で prompt ファイルを書き、依頼は user の言葉のまま入れる。承認後の操作は同文書に従う
   - wt の出力の `.path` を `--worktree` に渡して `start` で起動し、feature 名と worktree を user に 1 行で伝えて turn を終える。lead の報告は intercom で届く

3. **報告を中継する**
   - `[superagent] <feature> state=<state>: ...` で始まる intercom が届いたら、feature・state・本文・質問を、lead の文面のまま user に見せる。要約・言い換え・補足をしない。伝言で意味がずれると、user は lead が問うていない問いに答えることになる
   - 質問が複数の feature から溜まっていても、1 回の返答で出すのは 1 問にする。残りは答えを受けてから出す
   - `review` の報告にある `REVIEW_URL` はそのまま渡す。Crit は lead が持ち、結果も lead に届くので、router は承認を待たない

4. **答えを返す**
   - user の答えを、言い換えずに `bun <script> reply --ledger <台帳> --to <qN> --text <答え>` で送る。台帳は報告の末尾の `台帳:` の行にある。どの質問への答えか曖昧なら、送る前に user に確かめる
   - 終了コード 1 の「作業中か不在のため未配送」は、lead が受け取れなかったことを示す。user に伝え、`list` で lead が `idle` になれば同じ `reply` を送り直す。`absent`・`unknown` のままなら lead は落ちているので、user に伝えて `stop` する。続けるなら「状態を失ったとき」の引き継ぎ prompt と同じ feature・worktree で `start` し直す

5. **ticket を閉じる・続ける**
   - lead は承認された 1 フェーズと許可済みの操作を終えると `done` を報告して止まる。質問があれば user の答えを `reply` で送って台帳の質問を閉じ、その後（質問が無ければそのまま）`stop` で lead を止める。lead は答えを受けても次のフェーズに進まない。user が残りを続けると答えたら、残りを依頼として 2 から新しい feature を始める
   - lead が起動した Crit の daemon は lead とは別のプロセスグループで動き、`stop` では止まらない。`stop` の後、`~/.crit/sessions/<id>.json` のうち `cwd` がその worktree のものだけを、その `pid` で止める（`crit status --json` には cwd が無い）
   - user に頼まれたら `list`・`stop` を実行して結果を見せる。skill repo の lead には、cwd を `$KSTACK_SKILL_REPO` にした `list`・`stop` を使う。worktree の削除は user の明示指示を待つ。push・PR・merge は lead が `references/lead.md` の許可範囲で行い、router は代行しない

6. **review の通知を受ける**
   - `[review-inbox]` で始まる intercom は Crit のフックから届く通知で、user の発言ではない。router は中の JSON や対象コードを読まず、通知の保存 path を lead に渡す
   - `git -C "$KSTACK_SKILL_REPO" remote get-url origin` と `rev-parse --path-format=absolute --git-common-dir` で、taiki-kuraishi/skill の main checkout を指すことを確認する（common dir の親が main checkout）。未設定・参照不能・別 repo なら path の設定を user に求めて止まり、現在の repo に代わりの worktree を作らない
   - feature は `review-` に保存 JSON の絶対 path の SHA-256 の先頭 12 桁を付ける。同じ path の feature が台帳にあれば既存 ticket の状態を中継し、重複して起動しない
   - `git -C "$KSTACK_SKILL_REPO" fetch origin` の後、`wt -C "$KSTACK_SKILL_REPO" switch --create sa/<feature> --base origin/main --no-cd --format json` で worktree を作る。失敗時は状態を user に伝えて止まる。review が続けて届いたら、先行 lead の質問・review・CI を待たず、別 feature・worktree で並行して起動する
   - 2 と同じ形で prompt を書き、依頼には「`skill://skill-from-review` を読み、`<保存 JSON の絶対 path>` の `repo_root` と `comments_json` を確認して手順を最後まで回す。JSON や `repo_root` の対象コードを読めなければ path を添えて blocked で report する。分類案と追記か新規作成かの案は、対象の指摘とともに書く前に 1 問ずつ report し、承認されなかった指摘は SKILL 化しない。元 repo の approve で新しい SKILL を承認済みと扱わず、変更を Crit review に出す」を入れる。wt の `.path` を `--worktree` に渡して `start` する
   - 報告と質問は 3・4 で中継する。`reply --ledger` は報告にある skill repo の台帳を指定する。承認後の操作と `done` の時点は `references/lead.md` に従う

   ```text
   Bad: router が指摘を読んで SKILL を編集する / 複数 review の差分を同じ worktree に書く
   Good: 通知 A・B を別 lead に渡し、分類・変更・Crit の承認を各台帳で分けて中継する
   ```

   なぜ: router の context を増やさず、並行する review の変更と承認を混ぜないため。

## 状態を失ったとき

自動復旧を有効にするには、router と同じ profile で `omp install <この repo の checkout の絶対パス>` を実行し、omp を再起動する。router を named profile で起動した場合は、起動時の指定方法にかかわらず同じ名前を `OMP_PROFILE` に指定して実行する。SKILL のインストールとは別の設定で、リンク元の checkout は移動・削除せずに残す。

extension は成功した compaction または自動 shake が履歴を書き換えた後、session 名が厳密に `superagent` の場合だけ、この SKILL の再読と `list` での状態確認を促す followUp を送る。名前は `/alias superagent` で設定する。ほかの session 名や `/new` は自動復旧の対象にしない。

compaction の後、`/new` の後、何を待っているか曖昧になったときは、記憶で答えずに `list` と台帳を読み直す。台帳が正で、router の会話の記憶はその写しに過ぎない。

起動済み lead の依頼は、`start` が台帳と同じディレクトリの `<feature>.frames` に保存している。再開時はその `type: "prompt"` の `message` を読んで元の依頼と保存 JSON の絶対 path を引き継ぐ。これは起動用の記録で、router は指摘 JSON の内容を読まない。台帳がまだ無い起動失敗は入力 path を添えて user に報告し、同じ通知・path から 6 をやり直す。inbox の自動走査・再送は行わない。

## Red flags

| 誘惑                                                         | このフローの判断                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 「lead の質問を分かりやすく言い換えて出す」                  | そのまま出す。言い換えは lead の判断材料を落とす                                           |
| 「設計の質問なので router がコードを読んで答えを補う」       | 読まない。user の問いを lead に返す                                                        |
| 「lead が作業中で reply が届かないので intercom で直接送る」 | 直接送らない。作業中の非対話 session は intercom を捨てる。`idle` を待って `reply` し直す  |
| 「lead が止まっていそうなので kill して起動し直す」          | `stop` してから `start` する。kill だけでは台帳と pgid が食い違い、同名の lead が 2 つ残る |
