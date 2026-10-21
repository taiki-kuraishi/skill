---
name: kstack-root-driven-development
description: Root が user と要件・やることを合意し、次のフェーズだけを都度切り出して自ら実装し、既存パターンから外れる実装は書く前に user の承認を取り、各フェーズで kstack-review-request に従って user review（UI が変わるフェーズは dev server への live review を先に回す）を依頼し、承認まで止める開発フロー
disable-model-invocation: true
---

# kstack-root-driven-development

root が会話・判断・すべての編集を持ち、subagent は判断材料だけを返す。root は test code を書くが、その実行を含む検証作業は subagent が行う。user が現在のフェーズを承認するまで working tree を次のフェーズへ進めない。subagent は agent の組み込み tool で起動するため、このフローは Herdr・Tern の有無に依存しない。実装を子 session に渡す `kstack-handoff` は使わない。

## 責務

| 担当     | 責務                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| root     | user との会話、要件整理、やることの整理、次のフェーズの設計、source / test / docs の実装と指摘修正、user review の依頼・承認管理            |
| subagent | 必要になった調査・探索・検証コマンドの実行と、gate 前の skill-review・drift-review・ponytail-review を read-only で行い、証拠を root へ返す |
| user     | 要件・やること・各フェーズの合意、user review、フェーズ承認（承認済みフェーズの commit の許可を兼ねる）、push・PR・merge の判断             |

この Skill の実行中はこの役割分担を優先する。`orchestrating-development`、`delegating-small-tasks`、`subagent-driven-development`、`executing-plans` に実装を渡さない。TDD などの技法は root が使い、テスト実行のような検証は下記の分担に従う。

## Workflow

1. **開始状態を固定する**
   - repository の status を読み、開始前からある差分を記録する。現在の branch が default branch かも記録する。
   - 既存差分を今回の成果として扱わず、フェーズの commit にも含めない。
   - `status` / `diff` など read-only の VCS 確認と、`kstack-review-request` に従う user review の依頼・結果受領は workflow 管理なので root が直接実行してよい。test / build / lint / 再現 / 動作確認は検証として subagent へ委譲する。

2. **要件を合意する**
   - root が必要な質問をチャットで user へ聞く。omp の ask tool（選択式の質問 UI）は使わない。背景を書く場所が狭く、user は判断材料を見ないまま、用意された選択肢の中から選ぶことになるため。
   - 1 回の返答で聞くのは 1 問だけにし、答えを受け取ってから次を聞く。複数並べると答えの漏れに気づけず、後から催促することになるため。
   - 質問には、背景と判断材料（実際のコード、差分、比べた表）を添える。選択肢とおすすめを示してよいが、選択肢の外の答えも受け付ける。
   - 聞き直すときも、背景・前提・判断材料を書き直す。「先ほどの質問はいかがでしょうか」のように、前の message を参照するだけで聞かない。user は数 turn 前の質問を覚えていないため。
   - user が一部にしか答えなかったら、答えのあった分だけで進める。残りは次の 1 問として、背景から書き直して聞く。
   - adviser・subagent とのやり取りで決めたことは、user に見える形で書いてから進める。user が読んでいない話を前提にしない。
   - 必要なら、質問前または回答後に調査・探索を subagent へ出す。
   - `目的 / 対象 / 完了条件 / 対象外` をチャットで提示する。
   - user の承認を得てから手順 3 へ進む。

3. **次のフェーズを切り出す**
   - 初回は、完了条件を満たすためにこの session でやらなければならないことを、root が 1 項目 1 行の一覧にする。フェーズの分け方・順序・各項目の設計は、ここでは決めない。2 回目以降は、前のフェーズで分かったことに合わせて一覧を直す。
   - 一覧から、次に実装する 1 フェーズだけを切り出し、`成果` と判定可能な `完了条件` を付ける。後のフェーズは、前のフェーズが承認されてから切り出す。実装が終わると状況が変わり、先に決めたフェーズは古くなるため。
   - 一覧（直したなら直した箇所）と切り出したフェーズを、そのフェーズで要ると分かっている「既存パターンから外れる実装」（下記）と合わせてチャットで提示し、user と修正して承認を得る。user に決めてほしいことは、提示の後、手順 2 と同じ決まりで 1 問ずつ聞く。
   - 承認後、todo は現在のフェーズ（in progress）と、一覧の残り（pending）にする。in progress は常に1つだけ。task-list tool が無い環境では、同じ一覧と現在位置をチャットに保つ。
   - spec / plan ファイルは作らない。

4. **現在のフェーズを実装する**
   - root が対象ファイルを読み、source / test / docs のすべての編集を行う。
   - 合意に無い「既存パターンから外れる実装」が要ると分かったら、書く前に止めて user に承認を求める。gate での事後報告で済ませない。
   - 具体的な未知事項が生じた時だけ、調査・探索・検証を subagent へ委譲する。毎フェーズの儀式として verifier を起動しない。
   - 検証が必要だと判断した後は、短い test / build / lint / 再現コマンドでも subagent が実行する。root は先に試さず、並行して同じ確認をせず、結果だけを解釈する。
   - subagent の報告を判断材料にし、必要な変更は root が行う。

5. **skill-review・drift-review・ponytail-review でズレを直す**
   - フェーズの実装が終わったら、user review gate に初めて出す前に 1 回だけ、`kstack-skill-review` を使う subagent、`kstack-drift-review` を使う subagent、`ponytail-review` を使う subagent に、並行して現在のフェーズの変更をレビューさせる（以下、手順 5 の review）。規約のズレ、変更で古くなった文書（AGENTS.md・README.md・docs/）、要らないコードを先に直しておけば、user は review を挙動と設計の確認に使える。手順 4 の検証と違い、未知事項の有無に関わらず行う。
   - どれにも、現在のフェーズで変えたファイルと範囲を明示する。承認済みのフェーズは commit 済みだが、既定の対象（未 commit の差分すべて）では開始前の差分が混ざる。
   - 指摘は判断材料で、直すのは root。drift-review の指摘は、文書と実装のどちらに合わせるかをフェーズの要件で決め、要件で決まらないものは gate で user に聞く。ponytail-review の指摘のうち、直すと合意した要件を削る・既存パターンから外れるもの（責務の移動など）は、直さずに gate で user に聞く。「既存」に分けられた指摘や、フェーズの要件に照らして直さない指摘は、理由を gate で示す。
   - 修正で挙動が変わり得るなら検証を subagent に出し直し、gate で示す証拠を修正後の状態にそろえる。

6. **user review gate で止める**
   - 開始状態との差分を確認し、現在のフェーズに属する変更だけを報告する。
   - 変更は unstaged のまま保ち、承認前に commit しない。
   - root が `skill://kstack-review-request` に従い、repository root の未コミット差分について user に review を依頼する。承認済みのフェーズは commit 済みなので、その SKILL の取り決めどおり `HEAD` を基点にすると表示に混ざらない。レビューの範囲は現在のフェーズとし、開始前の差分が表示に含まれる場合は分けて示す。
   - UI（見た目・操作）が変わるフェーズは、コード review の前に、root が dev server を起動し、`kstack-review-request` の live review を回す。指摘を直してからコード review に進む。差分からは動作や見た目の崩れが読み取れず、見た目の指摘でコードが変わるため。文言だけの修正など live で確かめることが無いフェーズは省いてよいが、理由を `未解決事項` に書く。
   - 手順 5 の review で直した指摘は `検証と証拠` に、直さなかった指摘・要確認・SKILL 同士の食い違いは理由を添えて `未解決事項` に入れる。
   - 承認待ちとして応答を終える。`kstack-review-request` から承認結果を受け取るまでは次フェーズのコードに触れない。
   - 指摘は同じフェーズ内で root が修正し、gate に戻る。手順 5 の review は回し直さない（1 フェーズに 1 回）。修正で挙動が変わり得るなら、検証を subagent に出し直し、証拠を修正後の状態にそろえる。
   - 承認後、現在のフェーズに属する変更だけを stage し（開始前からある差分は含めない）、`skill://kstack-git` の「commit の書き方」で commit する。branch が default branch なら、最初の commit の前に `skill://kstack-git` の「PR の作り方」の手順 1 と同じ形で topic branch を切る。commit してから現在の todo を完了し、手順 3 に戻って次のフェーズを切り出す。一覧に残りが無ければ終わる。

フェーズの commit は手順 6 の承認後に root が行う（承認を commit の許可とみなす）。次のフェーズの review に承認済みの差分を混ぜないため。push・PR・merge はこの Workflow の外に置き、承認から許可を推測せず、別の明示指示に従う（PR と merge は `skill://kstack-git` の「PR の作り方」「PR を merge する」に従う）。

## 既存パターンから外れる実装

既存の実装の拡張と言えない実装は、書く前に user の承認を得る。依頼やフェーズの合意で決まっていない、次のものが該当する。

- 新しいディレクトリを作る（既存のディレクトリの下に足すものも含む）
- 新しい package・レイヤーを作る
- テストの無い package・app にテストを足す
- repo に前例の無い書き方をする（ライブラリの内部構造への依存、新しい依存の追加など）
- 規約（AGENTS.md・CLAUDE.md など）に抵触しうる切り方をする（1 ファイルに複数の責務など）
- 既存の関数・モジュールが持つ責務を別の場所へ移す（採番や計算をする場所を変えるなど）

前例に倣う形の拡張（項目の追加、型の generic 化など）は含めない。承認を求めるときは、外れる案と既存に倣う案を並べ、それぞれの代償を 1 行で添える。

```text
Bad: validator のスキーマの内部構造からカラム名を取り出して実装し、gate で「既存パターンから少しずれる点」として報告する
Good: 書く前に止め、「スキーマの内部構造に依存する / カラム名を別の定数で持つ（スキーマと二重管理）」を示して user に選んでもらう
```

なぜ: 書き上がった後の報告では、user は作り直しの手間を見て判断を曲げやすい。承認されないまま残ったずれは、次の実装の前例になる。

## Subagent contract

| 目的                 | Pi                                                 | Claude Code                         |
| -------------------- | -------------------------------------------------- | ----------------------------------- |
| コードベース探索     | `scout`                                            | `Explore`                           |
| 外部・ライブラリ調査 | `researcher`                                       | 調査可能な read-only agent          |
| テスト・挙動検証     | `worker` に no-edit を明示 / 静的確認は `reviewer` | `general-purpose` に no-edit を明示 |
| 手順 5 の review     | `reviewer`                                         | `general-purpose` に no-edit を明示 |

各依頼に `目的 / cwd / 対象範囲 / read-only 境界 / 完了条件 / 必要な証拠 / 報告形式` を含める。手順 5 の依頼では `kstack-skill-review`・`kstack-drift-review`・`ponytail-review` のどれを使うかを指示し（SKILL として呼べない subagent には SKILL.md の path を渡す）、報告形式はその SKILL の形式にする。`ponytail-review` が環境に入っていなければ、root が代わりに review せず、入っていないことを gate の `未解決事項` に書く。`worker` / `general-purpose` は編集 tool を持ち得るため、read-only は agent 名でなく dispatch の権限境界として明示する。subagent は編集、stage、commit、user への質問を行わない。独立した依頼だけを並列化する。subagent 経路が使えない場合は exact failure を user に報告し、root が黙って代行しない。

## Red flags

| 誘惑                                                                                 | この Workflow の判断                                                                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 「root-driven は指揮だけ。worker が実装してよい」                                    | root が全編集を行う。subagent は証拠だけを返す                                                                                         |
| 「承認前に checkpoint commit しておけば安全」                                        | 承認前に commit しない。user は未 commit の差分を review し、commit は承認後に現在のフェーズの変更だけで行う                           |
| 「緊急なので review 中に次へ進む」                                                   | 緊急性を user へ伝え、現在の gate で止まる                                                                                             |
| 「20秒のテストなら root が直接回す方が速い」                                         | 必要性を決めるのは root、検証コマンドを実行するのは subagent。速さ・root の最終責任・併用を理由にした hybrid も不可                    |
| 「承認済みフェーズは commit せずに次フェーズを始めてもよい」                         | 承認済みの変更を commit してから次のフェーズに触れる。未 commit のまま進めると、次の review に承認済みの差分が混ざる                   |
| 「全フェーズを先に決めた方が見通しが良い」                                           | 切り出すのは次の 1 フェーズだけ。前のフェーズを実装すると状況が変わり、先に決めた後のフェーズは古くなる                                |
| 「小さい変更なので手順 5 の review は省く」                                          | 規約や文書のズレ、要らないコードは変更の大きさと関係なく user の review に混ざる。gate に初めて出す前に 1 回 subagent に review させる |
| 「user の指摘を直したので手順 5 の review を回し直す」                               | 回し直さない。review は gate に初めて出す前の 1 回で、指摘の修正は user が次の gate で確かめる                                         |
| 「文書を触っていないので drift-review は要らない」                                   | コマンド・パス・設定・挙動を変えれば、触っていない文書が古くなる                                                                       |
| 「規約や文書は root が自分で見れば足りる / review した subagent に直させる方が速い」 | review は subagent、直す判断と編集は root。書いた本人の見直しはズレを見落とし、SKILL や文書の一式を読むと root の context が埋まる     |
