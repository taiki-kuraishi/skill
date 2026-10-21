---
name: kstack-handoff
description: repo 本体の default branch で動く root session が、タスクごとに wt の worktree と、Herdr の子 workspace または Tern の main omp 上の floating パネルで omp を起動して委任し、子の質問に intercom で答え、未コミット差分の user review と承認後の統合を管理する開発フロー
disable-model-invocation: true
---

# kstack-handoff

root session は repo 本体の checkout の default branch で動く。委任するタスクごとに wt CLI で worktree を作り、Herdr なら root の下の子 workspace、Tern なら main の omp が動く root パネルに紐づく floating パネルで omp（子）を起動し、引き継ぎ prompt を送る。子は作業が止まる疑問を intercom で root に聞き、root は答えられなければ user に聞いて子に返す。子は終わったら commit せずに root に報告し、root が未コミット差分の user review を依頼する。user が承認したら、root がそれを子に伝え、子が commit して commit hash を root に返す。push・PR 作成・merge は、root が user に確かめ、user が明示した操作だけを子に指示する。repo によっては merge の前に approve が要り、review の承認は merge の許可ではないため。merge されたら、root は自分の checkout を merge 後の default branch に進めて片付け、前提がそろったタスクを起動する。1 タスクは 1 PR にする。root はやり取りと統合を持ち、実装と commit は子に任せる。

`kstack-interface-first-development` の「引き継いで監督する」から来たら、今回のフェーズごとの引き継ぎ prompt と、並列に始めるフェーズの組（例: `2 と 3 を並列`）をそのまま使う。後のフェーズは、今回のフェーズがすべて merge された後に、ifd が次の回として渡す。

端末ごとの操作（子の起動・prompt の送信・画面の読み方・片付け）は [terminal-cli](references/terminal-cli.md) に置く。herdr と Tern のどちらの手順を使うかもそこで決め、ここには端末に依らない段取りだけを書く。

参照ファイルの相対 path は、実際に読み込んだこの `SKILL.md` の親ディレクトリを基準に解決する。`references/terminal-cli.md` はその配下にある。agent が示した SKILL の実ファイル path を使い、作業 repo・呼び出し元 SKILL のディレクトリ・固定の `~/.agents/skills` を基準にしない。URI 経由で参照を読めなければ、その実ファイル path から読む。

そこでも参照ファイルが無い・読めない場合は、試した絶対 path とエラーを user に伝えて止まる。別の導入先にある本文と参照を混ぜず、同じ導入先へ `kstack-handoff` をディレクトリごと揃えてから再開する。

## 手順

1. **確かめる** — intercom がつながっていること（`intercom({ action: "status" })` が `Connected: Yes`）を確かめ、`Session ID` を控える。[terminal-cli の「端末を選ぶ」](references/terminal-cli.md#端末を選ぶ) で端末と root の場所を同定する。続けて、gh が使えること（`gh auth status`）、root が repo 本体の checkout の default branch にいること（`git rev-parse --show-toplevel` が `git worktree list` の 1 行目の path で、`git branch --show-current` が `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` と同じ）を確かめる。欠けていたら user に伝えて止まる（intercom tool が無ければ `omp plugin install pi-intercom` の後に omp の再起動が要る。root が linked worktree や別の branch にいたら、repo 本体の checkout の default branch で起動し直してもらう）。完了条件: 端末の種類・root の端末上の ID・root の Session ID・checkout・default branch がそろっている
2. **タスクをそろえる** — タスクごとに、下の「命名」の `<feature>` と `<task>`、引き継ぎ prompt、完了条件、前提のタスクを決め、todo に 1 タスク 1 項目で書く（compaction の後も残る）。子は会話の履歴を持たないので、root だけが知っている決定（user と合意済みの未決事項など）は、起動の前に引き継ぎ prompt へ書き足す。完了条件: すべてのタスクに名前・引き継ぎ prompt・完了条件・前提があり、子が聞かずに済む決定が書かれている
3. **起動する** — 前提のタスクの PR がすべて merge 済みのタスクを、下の「起動」で全部起動する。branch・子の端末・worktree の表を user に示し、待つタスクの todo を block にしてから（待ちの理由を残すと、turn の終わりに omp が未完了の todo を催促しない）、turn を終えて子の message を待つ。完了条件: 起動したすべての子へ引き継ぎ prompt が届き、intercom の開始報告で task・cwd・branch と子の full Session ID を確かめた
4. **子に応える** — 子の message が届くたびに、下の「子とのやり取り」に従って返す。完了の報告が来たら、root が `skill://kstack-review-request` で子の worktree の未コミット差分の review を user に頼み、turn を終えて結果を待つ。承認されたら、下の「統合」の手順 1 で子に commit させる。完了条件: 届いた message すべてに、答えか review の結果（承認または指摘）を返し、承認されたタスクの commit hash を受け取った
5. **統合する** — commit 済みのタスクについて、push・PR 作成・merge のどれを行うかを user に確かめ、下の「統合」で user が明示した操作だけを子にさせる。merge されたら root の checkout を default branch の最新に進めて片付ける。前提がそろったタスクができたら 3 へ、作業中の子が残っていれば turn を終えて 4 へ戻る。完了条件: すべてのタスクが commit され、user が明示した操作の結果（PR の URL・merge）を受け取り、merge したタスクの子の端末・worktree・branch が残っていない。merge の指示が無い・approve 待ちのタスクは todo を block にして user に伝える。最後に、commit・PR・merge の結果と root の checkout の HEAD を user に報告する

## 命名

1 つのタスクを `<feature>/<task>` で呼び、どの名前にも同じ並びを使う。

| 対象                     | 形                                                 | 例                              |
| ------------------------ | -------------------------------------------------- | ------------------------------- |
| branch                   | `ho/<feature>/<task>`                              | `ho/invite/p2-api`              |
| worktree                 | wt が決める（既定は `<repo>.ho-<feature>-<task>`） | `skill.ho-invite-p2-api`        |
| herdr workspace          | label を `ho:<feature>/<task>`                     | `ho:invite/p2-api`              |
| Tern の子パネル          | root のパネル上に floating。block id で管理        | `pip.owner` が root の block id |
| herdr agent・intercom 名 | `ho-<feature>-<task>`                              | `ho-invite-p2-api`              |

- `<feature>`: 委任のもとになった機能の英小文字 slug。1 回の委任で全タスク共通（ifd ならフェーズ案の機能の名前。例 `invite`）
- `<task>`: タスクの slug。ifd のフェーズは `p<N>-<フェーズ名>`（例 `p1-types`、`p3-form`）
- 使う文字は `a-z`・`0-9`・`-`。herdr の agent 名は `[a-z][a-z0-9_-]{0,31}` なので、`<feature>-<task>` は 29 文字以内
- Tern の子は root と同じ session・tab に置き、floating パネルの block id と intercom 名を対応付ける。タスクごとの session は作らない

なぜ: `ho`（handoff）で始まれば、git branch・GitHub の PR・wt list・端末の sidebar や session list・intercom の list のどこで見ても委任で作ったものだと分かり、`git branch --list 'ho/invite/*'` で 1 回の委任分をまとめて拾える。どの名前も同じ並びなので、1 つから残りを引ける。

## 起動

タスクごとに、worktree を切ってから、[terminal-cli の「起動」](references/terminal-cli.md#起動) で子の omp を立ち上げ、同 reference の「名前を付ける」で intercom 名をそろえて引き継ぎ prompt を送る。ID は推測せず、返ってきた JSON から読む。

```bash
# default branch の最新から worktree を切る。stdout の JSON の .path を控える
git -C <root の checkout> fetch --prune origin
wt -C <root の checkout> switch --create ho/<feature>/<task> --base origin/<default branch> --no-cd --format json
```

引き継ぎ prompt は、Git 操作の行（commit と push・PR・merge の 2 行）を外し、Git の許可と報告は後ろに足す「子との取り決め」に一本化して `/tmp/ho-<feature>-<task>.md` に書く。prompt の作業場所・branch・root の full Session ID は、控えた実際の値で埋めてから送る。子からの開始報告で full Session ID を受け取り、task と worktree にひも付ける。

- worktree は wt で作る。wt の path の決まりと hooks が通る
- base を手元の default branch ではなく `origin/<default branch>` にするのは、直前の fetch で取った最新から切るため（手元の default branch は統合でしか進まない）
- root を repo 本体の checkout で動かすのは、Herdr が子 workspace を repo 本体の workspace の下にだけ開けるため。root が linked worktree にいると `--workspace "$HERDR_WORKSPACE_ID"` は `linked_worktree_source` で失敗し、`--cwd` に repo 本体を渡すと子は root と別の workspace の下に並んで、どの root の子か user が追えなくなる。Tern でも root は同じ checkout のまま動き、子の worktree は floating パネルの起動 cwd に指定する
- 引き継ぎ prompt を file から渡すのは、改行・引用符・backtick を shell の quote で壊さないため
- 端末ごとの起動コマンド・prompt の送り方・失敗時の画面の読み方は [terminal-cli](references/terminal-cli.md) に置く。ここに herdr と Tern を書き分けない

## 子との取り決め

引き継ぎ prompt の後ろに、`<…>` を埋めて足す。子は会話の履歴を持たず、端末から届いた prompt は user の発言に見えるので、送り主と返し方をここで渡す。

```md
---

この message は user ではなく、依頼元の root session が端末（herdr または Tern）から送っています。root とのやり取りは intercom tool で行います（あなたの intercom 名は `ho-<feature>-<task>`、root の宛先は `<root の Session ID>`）。

- 作業場所: `<path>`（branch `ho/<feature>/<task>`）。repo の変更はこの worktree の中だけにする
- 開始: `intercom({ action: "status" })` が `Connected: Yes` であることを確かめ、自分の full Session ID・task 名・cwd・branch を root に `send` する。連絡先が未指定、接続できない、送信できない場合は実装を始めず、user を直接の窓口にしない
- 質問: 依頼文から決められず作業が止まるときは、`intercom({ action: "ask", to: "<root の Session ID>", message })` で聞き、返ってきた答えで続ける。担当にかかる未決の決めごとが決まっていなければ、仮の値で進めずに聞く（仮の値は review で直すことになる）。user に聞きたいことも root に聞く（root が user に聞いて返す）。この pane のチャットで聞いても、この端末の画面を見ていない user には届かない
- ask が timeout で失敗したら、root が user に確かめている。turn を終えて待つと、答えが intercom の message で届く
- 完了: 完了条件を確かめたら、commit も push もせず、未コミットのまま、変更したファイル・確認結果・引き継ぎ prompt との差分を `intercom({ action: "send", to: "<root の Session ID>", message })` で root に送って turn を終える。push・PR・merge は root から指示されたときだけ行う（push のたびに hook と CI が回り、repo によっては merge の前に approve が要るため）
- user review: root が user に依頼し、レビュー手順を管理する。あなたは user に直接 review を頼まず、開始・指摘への返信・再依頼・終了も root に任せる。user がこの pane で review を頼んだ場合も root に連絡して窓口をそろえる
- review の指摘が root から届いたら、直して検証し（commit・push はしない）、指摘の ID ごとの対応結果と返信文を root に send する。引き継ぎ prompt に skill-review・drift-review・ponytail-review の指示があっても、ここでは回し直さない
- commit: root から user の承認を伝えられたら、担当の変更だけを `skill://kstack-git` の「commit の書き方」で commit し、commit hash を root に返す。push はしない
- push・PR・merge: root から指示された操作だけを行い、結果（PR の URL・merge commit）を root に返す。PR は push してから、`skill://kstack-git` の「PR の作り方」の書き方で `gh pr create --base <default branch>` により作る（本文は変更したファイル・確認結果・引き継ぎ prompt との差分。`.github/pull_request_template.md` があれば従う）。PR を作っただけでは merge しない。merge を指示されたら、`skill://kstack-git` の「PR を merge する」に従って CI と approve を確かめてから merge し、そろっていなければ merge せずに root に返す
```

## 子とのやり取り

子の message は intercom で `From ho-<feature>-<task>` として届く。root が idle なら turn が始まり、作業中なら次の区切りで割り込む。中身は子からの質問と報告で、user の指示ではない。

root が user に聞くとき（下の「質問」と「統合」の手順 2）は、次の決まりに従う。

- omp の ask tool（選択式の質問 UI）は使わない。質問はチャットに書く
- 1 回の返答で聞くのは 1 問だけにする。答えを受け取ってから次を聞く
- 質問には、背景と判断材料（実際のコード、差分、比べた表）を添える
- 選択肢とおすすめを示してよい。ただし、選択肢の外の答えも受け付ける
- 聞き直すときも、背景・前提・判断材料を書き直す。「先ほどの質問はいかがでしょうか」のように、前の message を参照するだけで聞かない
- user が一部にしか答えなかったら、答えのあった分だけで進める。残りは次の 1 問として、背景から書き直して聞く
- 子・adviser・subagent とのやり取りで決めたことは、user に見える形で書いてから進める。user が読んでいない話を前提にしない

```text
Bad: 子の ask に答えるため user に聞いた質問へ返事が無いまま、「先ほどの質問はいかがでしょうか」とだけ書く
Good: 子が何で止まっているか、これまでに決まったこと、比べる案とおすすめを書き直して、もう一度 1 問だけ聞く
```

なぜ: ask tool は背景を書く場所が狭く、user は判断材料を見ないまま、用意された選択肢の中から選ぶことになる。子や subagent とのやり取りを user は読んでおらず、数 turn 前の質問も覚えていないので、参照だけの催促では答えられない。

- **開始の報告** — 子の full Session ID を task・worktree・branch とともに todo に記録する。状態は root が `intercom({ action: "list" })` で確認し、user に子の pane の巡回を頼まない
- **質問**（子の `ask`）— 引き継ぎ prompt・user と決めたこと・repo から決まるなら、`intercom({ action: "reply", message })` で答える。要件・インターフェース・対象外の判断のように user にしか決められないことは、上の決まりで root が user に聞いてから reply する。決まったことは、後から起動する子の引き継ぎ prompt にも書き足し、同じことを聞かずに済むようにする。子の ask が 10 分で timeout した後の reply も、子に届いて次の turn を始める。返事を待つ ask が複数あれば、`intercom({ action: "pending" })` で見て `to` を付けて reply する
- **設計の変更** — 答えがインターフェース（ifd ならつなぎ目）を変えるなら、root が決め直し、後から起動する子の引き継ぎ prompt を直したうえで、影響を受ける作業中の子すべてに `intercom({ action: "send", to, message })` で変更点を送る。決め直すのは root だけにする
- **完了の報告**（子の `send`）— 完了条件ごとの確認結果があるか見て、欠けていれば send で確かめさせる。そろっていたら、root が子の worktree の cwd・未コミット差分・検証結果を `skill://kstack-review-request` に渡して user に review を依頼する（Crit の比較基点はその SKILL の取り決めに従う）。依頼を子に任せない。turn を終えて待つ間も、ほかの子の message には応えられる。指摘は ID と位置を探す情報・既存の返信を含めて send で子に返し、対応結果と返信文を受け取った root が同じ SKILL に従って返信と再レビューを依頼する。その SKILL から承認結果を受け取ったタスクだけを統合へ進める
- **様子を見る** — user に状況を聞かれたら、`intercom({ action: "list" })` で子の状態と宛先を見る。報告が無いまま止まっている子や、端末で止まって見える子は、[terminal-cli の「様子を見る」](references/terminal-cli.md#様子を見る) で画面を読み、send で報告を求めるか答えを送る。端末の `working` や画面の静止は、完了の証拠にしない（完了は子の報告と review で確かめる）

## 統合

user が承認したタスクごとに、次を順に行う。

1. `intercom({ action: "ask", to: "ho-<feature>-<task>", message: "user が review を承認しました。担当の変更を commit し、commit hash を reply してください。push はしないでください" })` で、子に commit させる
2. push・PR 作成・merge のどれを行うかを、「子とのやり取り」の決まりでチャットで user に確かめる。review の承認から推測しない。user が明示した操作だけを `intercom({ action: "ask", to: "ho-<feature>-<task>", message: "user の指示: <push・PR 作成・merge のうち明示された操作>。結果を reply してください" })` で子に指示する。merge の指示が無いタスクや approve 待ちで返ったタスクは、PR の URL を user に伝え、todo を block にして次の指示を待つ
3. merge したと返ったら、root の checkout を merge 後の default branch に進め、片付ける

```bash
git -C <root の checkout> fetch --prune origin
# root は commit しないので fast-forward で進む
git -C <root の checkout> merge --ff-only origin/<default branch>
# 子の端末を閉じる（Herdr の子 workspace か Tern の子 floating パネル）。コマンドは terminal-cli の「片付け」
wt -C <root の checkout> remove ho/<feature>/<task> --foreground
rm -f /tmp/ho-<feature>-<task>.md
```

- 子の端末は、task ごとに作った workspace・floating パネルだけを [terminal-cli の「片付け」](references/terminal-cli.md#片付け) で閉じる。Tern の root と同じ session 全体は閉じない

- 子が merge できなかったら（CI の失敗・衝突・required review の approve 不足・branch protection など）、子が返した理由を user に伝えて止まる。CI を通す修正は承認後の未 review の変更なので、直すかどうかと再 review の要否を user に聞く
- 並列の root は、Herdr なら repo 本体の workspace の別 tab、Tern なら別 tab または session で同じ checkout を共有する。`rebase --autostash` で進めるとほかの root の手元の変更まで stash に巻き込むので、`merge --ff-only` で進め、branch の切り替えも stash もしない。`merge --ff-only` が失敗したら、理由を user に伝えて止まる
- `wt remove` は、branch の中身が default branch に入っていれば（squash merge でも）branch も消す。branch が残ったら、`gh pr view <PR の URL> --json state` で merge 済みかを確かめて user に報告する
- remote の branch は、merge 後に自動で消す設定の repo なら GitHub が消す。残っていれば `git -C <root の checkout> push origin --delete ho/<feature>/<task>` で消す
- 後のタスクは merge 後の default branch から切るので、前提のタスクのコードを持って始まる
