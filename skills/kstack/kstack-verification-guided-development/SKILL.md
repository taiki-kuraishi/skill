---
name: kstack-verification-guided-development
description: UI を持たない API・package の業務ルール（認可・状態の遷移・削除の連鎖）を Dafny の定理として user と合意し、証明と実装は subagent に書かせ、user の実装コードレビューを「主張のレビュー」と「モデルとの突き合わせ」に置き換える開発フロー
disable-model-invocation: true
---

# kstack-verification-guided-development

user が読むのは定理の主張と HTTP の口だけにする。証明が主張を満たすかは Dafny が、実装がモデルと同じに動くかは突き合わせ（fast-check による差分テスト）が判定する。フェーズの切り出し・user review gate・commit は `skill://kstack-root-driven-development` に従い、この SKILL は「誰が何を書くか」と「gate で何を見せるか」だけを置き換える。

## 使う場面

- 使う: 入力と出力の関係で書ける業務ルールを持つ API・package（認可、状態の遷移、削除の連鎖、並び順）
- 使わない: UI、外部サービスの呼び出しが中心の処理、並行性そのものが本題の処理（下の「突き合わせが守らないもの」）

## 責務

| 担当              | 書くもの・行うこと                                                        |
| ----------------- | ------------------------------------------------------------------------- |
| user              | 定理の主張と HTTP の口の合意、gate での承認                               |
| root              | モデル（`Model.dfy`）、定理の主張（`Spec.dfy`）、突き合わせ（`harness/`） |
| 証明役の subagent | `Proofs.dfy` だけを編集する                                               |
| 実装役の subagent | `app/` の下だけを編集する（モデルの外の振る舞いのテストも含む）           |
| 検証役の subagent | 下の確認コマンド、test script、使い捨ての実装での検出の確認               |

`kstack-root-driven-development` の責務表・手順 4 の「root がすべての編集を行う」・Subagent contract の「依頼するのは事実の収集・検証と review だけ」を、この表で置き換える。正しさを root の目ではなく機械が判定するので、証明と実装を subagent に任せられる。その前提として、証明役と実装役には主張・モデル・突き合わせを変えさせない。証明役と実装役は編集できる agent（Pi は `worker`、Claude Code は `general-purpose`）で起動し、編集してよい範囲を依頼に書く。

```text
dafny/Model.dfy   モデル。API の処理を純粋な関数（Handle）で書く
dafny/Spec.dfy    abstract module に lemma の requires / ensures だけを書く
dafny/Proofs.dfy  module Proofs refines Spec で証明を書く
dafny/build/      モデルを変換した JS。生成物なので .gitignore に入れる
harness/          モデルの JS と実装を突き合わせる
app/              実装
```

仕様（`dafny/`）と実装は同じ repo に置き、同じ PR に入れる。片方だけが main に入ると、突き合わせが古い仕様と比べる。

## Workflow

`kstack-root-driven-development` の手順 3 で、次の 3 つを別々のフェーズとして切り出す。各フェーズの終わりに、同 SKILL の手順 5（skill-review・drift-review・ponytail-review）と手順 6（gate と commit）を回す。

| フェーズ         | この SKILL の手順 |
| ---------------- | ----------------- |
| 主張             | 手順 1            |
| 証明と突き合わせ | 手順 2・3         |
| 実装             | 手順 4・5・6      |

1. **主張と HTTP の口を合意する**
   - root が `Model.dfy` と `Spec.dfy` を書く。主張には、日本語で何を保証するかの 1 文を添える。
   - モデルには、状態を読む操作（一覧など）を必ず入れる。手順 3 で、操作の response に現れない壊れ方を見えるようにするため。
   - user に、主張と主張に出てくる定義を見せ、前提（`requires`）が強すぎないか、結論（`ensures`）が足りているかを聞く。続けて別の 1 問で、HTTP の口（endpoint、status の優先順位、id の採番）を聞く。
   - 完了条件: 主張のフェーズの gate が承認され、commit されている。この commit を、後のフェーズの「承認済み commit」とする。

2. **証明を subagent に出す**
   - 証明役には、編集してよいのは `Proofs.dfy` だけで、`assume`・`{:axiom}`・`{:verify false}`・body の無い lemma は使わないと伝える。
   - 終わったら、検証役に次の 2 つを実行させる。
     - `git diff --name-only <承認済み commit> -- dafny harness ':!dafny/Proofs.dfy'` と `git status --porcelain -- dafny harness` に、`Proofs.dfy` 以外が出ない
     - `dafny verify dafny/Proofs.dfy` が 0 errors、`dafny audit dafny/Proofs.dfy` が 0 findings（audit は findings があっても exit 0 なので、件数を読む）
   - 完了条件: 2 つとも通っている。

   ```text
   Bad: subagent の細工を防ぐ検査 script を作り、抜け道を塞ぎ続ける
   Good: 上の 2 コマンドで、主張の書き換えと証明の飛ばしだけを止める
   ```

   なぜ: PoC では検査 script に 8 つの抜け道が見つかり、塞ぐほど script の管理が重くなった（[poc-results.md](references/poc-results.md)）。現実に起きるのは、行き詰まった subagent が主張を弱める・証明を飛ばす程度で、2 コマンドで止まる。git の index や `.git` を書き換える細工は、この 2 コマンドでは止まらない。それを疑うなら、CI で clone し直してから検査する。

3. **突き合わせを作る**
   - test script は、モデルを JS に作り直してから test を走らせる（例: `dafny translate js --no-verify --include-runtime -o dafny/build/model.js dafny/Model.dfy && bun test`）。作り直さないと、古いモデルと比べて通る。
   - harness は、実装が export する「初期データを受け取り、in-memory の DB を作って app を返す関数」（PoC では `createApp(projects)`）を呼ぶ。実装の path は環境変数で差し替えられるようにする（PoC では `APP_MODULE`）。
   - fast-check で初期データと操作の列を作り、モデルと実装の response（status と body）を比べる。モデルを先に実行する（実装が入力の配列を書き換えても、期待値が狂わない）。
   - 各 run の最後に、すべての親の一覧を member として読む。
   - id の範囲を狭くする。生成した操作をモデルに流して status を一度集計し、成功・403・404 のどれかが数十回に届かなければ、id の範囲と操作の重みを直す。
   - run は 3000 にし、test の timeout をそれに合わせる（PoC では約 3 秒で、bun test の既定 5 秒に近い）。
   - 完了条件: 検証役が `app/` の外に使い捨ての実装（正しいもの 1 つと、認可の判定を外す・削除の連鎖を外す・他の行まで更新するように壊したもの）を書き、正しいものが通り、壊したものを 5 回中 5 回検出している。

4. **実装を subagent に出す**
   - 実装役には、編集してよいのは `app/` の下だけと伝え、手順 1 で合意した HTTP の口と、手順 3 の「app を返す関数」の形を契約として渡す。id の採番は、モデルと同じ「既存の最大 id + 1」（SQLite の `INTEGER PRIMARY KEY`、AUTOINCREMENT なし）にさせる。
   - テストを通すために harness やモデルを読み替えたくなったら、直さずに報告させる。
   - 完了条件: 検証役が、手順 2 の 1 つ目のコマンドの対象を `':!app'` に替えて `app/` の外が変わっていないことを確かめ、test script を 5 回走らせてすべて通っている。

5. **モデルの外を、review と小さなテストで守る**
   - `kstack-root-driven-development` の手順 5 で ponytail-review に、突き合わせが通っても残るバグ（並行性、壊れた入力、DB の制約、transaction）を、再現付きで探させる。
   - モデルの外の振る舞い（壊れた入力への 400 など）は、モデルに足さず実装で扱い、実装役が `app/` の下に小さなテストを書く。そのテストが test script で実際に走ることを、検証役に確かめさせる。
   - 完了条件: ponytail-review の指摘が、すべて「直した」か「直さない（理由付き）」に分かれている。

6. **gate では実装のコードを読まない前提にする**
   - gate の依頼では、見てほしい範囲を主張・harness の差分と、突き合わせ・検出の結果・手順 5 で直した指摘に限ると伝え、`app/` の差分は読まない前提であることを添える（Crit の画面には `app/` も出る）。
   - 完了条件: gate が承認されている。user が実装を読まないと判断できなかったら、その理由を `未解決事項` に書く。どこが機械で守れていないかの印になる。

## 突き合わせが守らないもの

| 種類       | PoC で見つけた例                                                   | 守る手段                                           |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| 並行性     | 作成の確認と insert の間に削除が割り込み、消した親にコメントが残る | 手順 5 の review                                   |
| 壊れた入力 | JSON でない body で 500、数値の body が文字列に化けて保存          | 実装で 400 にし、小さなテスト                      |
| DB の作り  | 親の削除で子を手で消し、transaction も外部キーも無い               | 手順 5 の review                                   |
| 規約       | `if` の前の空行、引数の形、doc                                     | lint（`packages/oxlint-config`）と手順 5 の review |

なぜ: モデルは操作を 1 つずつ、正しい形の入力で処理する。同時に走る状態、壊れた入力、response が同じになる作りの違いは、モデルと実装の差として現れない。PoC では、並行性のバグを 5 回中 1 回も検出しなかった。また証明は、Z3・Boogie と JS への変換器を信頼した上で通っている。

## kstack-testing との関係

このフローの API では、`kstack-testing` の「正常系 1 件と、振る舞いごとに 1 件」を、突き合わせ 1 本に置き換える。モデルの外の振る舞い（400 など）だけは、`kstack-testing` に従って振る舞いごとにテストを書く。この 400 は schema の宣言ではなく実装の入口の判定なので、`kstack-testing` の「入力 validation のテストは書かない」には当たらない。

なぜ: 振る舞いのケースは定理（すべての入力）と突き合わせ（3000 run）が受け持つ。手書きのケースを並べても、確かめる範囲は増えない。

## はまりどころ

- 削除の連鎖の漏れは、id の採番を通して見つかる（消えなかった子が最大 id を押し上げる）。実装の採番がモデルと違うと、この漏れを見逃す。
- Dafny が生成する JS は `module.exports` を持たない CommonJS のスクリプトなので、`new Function` で評価して `Model` と `_dafny` を取り出す。`nat` は `bignumber.js` の `BigNumber`、`string` は `_dafny.Seq.UnicodeFromString` / `toVerbatimString(false)` で変換する。
- libicu の無い環境では、Dafny（.NET）は `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1` を付けないと起動しない。
- Dafny の証明は Z3 のヒューリスティックに頼るので、Dafny を上げたら手順 2 の 2 コマンドを回し直す。
