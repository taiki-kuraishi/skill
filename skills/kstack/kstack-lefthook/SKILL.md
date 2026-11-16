---
name: kstack-lefthook
description: lefthook（lefthook.yml、.config/lefthook/*.yml）で git hook を書くときの規約。root の lefthook.yml に共通設定・extends・どの toolchain にも属さない job だけを置き、toolchain ごとのファイルに分けること、jobs と name の付け方、stage_fixed と同じファイルを書き換える手順の順序、glob_matcher と YAML anchor、mise タスクを呼ばず生コマンドを書くこと、lefthook の版の固定と install を扱う。lefthook の hook や job を追加・修正・分割・レビューするとき、pre-commit に format や lint を足すとき、CI と hook の検査をそろえるときにも発火させる。
---

# kstack-lefthook

[lefthook](https://lefthook.dev/) で git hook を書くときの規約。理由を理解した上で適用すること。mise タスクの書き方は `kstack-mise-tasks` にある。

## root の lefthook.yml には共通設定と toolchain に属さない job だけを書き、toolchain の job はファイルに分ける

root の `lefthook.yml` には、`output`・`glob_matcher`・`extends` などの共通設定と、hook の設定（`parallel` など）と、どの toolchain にも属さない job（`lefthook validate` など）だけを書く。toolchain に属する job は `.config/lefthook/<toolchain>.yml` に分けて `extends` で読む。分けた先のファイルには hook の `jobs` だけを書き、hook の設定を書かない。

```yaml
# Bad: 分けた先のファイルで hook の設定を書き換える
# .config/lefthook/ts.yml
pre-commit:
  parallel: false
  jobs:
    - name: lint-ts
      run: bun oxlint
```

```yaml
# Good: lefthook.yml
glob_matcher: doublestar

extends:
  - .config/lefthook/ts.yml
  - .config/lefthook/markdown.yml

pre-commit:
  parallel: true
  jobs:
    - name: lint-lefthook
      run: lefthook validate
```

```yaml
# Good: .config/lefthook/ts.yml
pre-commit:
  jobs:
    - name: format-ts
      stage_fixed: true
      run: bun oxfmt && bun oxlint --fix
    - name: lint-ts-type-check
      run: bun tsc --noEmit
```

なぜ: 1 つのファイルに全 toolchain の job を並べると、触らない toolchain の job まで読まないと変更箇所が見つからない。`extends` は hook の設定もマージするので、分けた先のファイルに `parallel` を書くと、root で書いた値がその hook の全 job について上書きされる。

## jobs で書き、どの job にも全体で一意な name を付ける

hook は `commands:` ではなく `jobs:` で書く。どの job にも、動詞を先頭に置いた kebab-case の `name`（`format-ts`・`lint-ts-type-check`）を付け、`lefthook.yml` と `.config/lefthook/*.yml` の全体で重ねない。変えたら `lefthook validate` と `lefthook dump` で、マージ後の設定を確かめる。

```yaml
# Bad: name が無い / 別のファイルと同じ name
pre-commit:
  jobs:
    - run: bun oxlint
    - name: lint
      run: markdownlint-cli2
```

```yaml
# Good
pre-commit:
  jobs:
    - name: lint-ts
      run: bun oxlint
    - name: lint-markdown
      run: markdownlint-cli2
```

なぜ: `extends` は `name` の同じ job を後から読んだファイルの値で黙って上書きし、`name` の無い job は末尾に足すだけなので、どちらも別のファイルの job と取り違えても気づけない。`lefthook validate` は `name` の重複を検査しないので、マージ後の結果は `lefthook dump` で見る。`jobs` は順序のあるリストなので、job の並びが設定に書いた順のまま残る。

## pre-commit でファイルを書き換える job には stage_fixed を付け、同じファイルを書き換える手順は 1 つの job で順に回す

`pre-commit` で formatter や `--fix` のようにファイルを書き換える job には `stage_fixed: true` を付ける（`stage_fixed` は `pre-commit` でだけ効く）。同じファイルを書き換える手順や、前の手順の出力を読む手順は、別の job に分けず 1 つの job の `run` で `&&` でつなぐ。

```yaml
# Bad: parallel: true の hook で、同じファイルを書き換える手順を別の job にする
- name: format-ts
  run: bun oxfmt
- name: fix-ts
  run: bun oxlint --fix

# Good
- name: format-ts
  stage_fixed: true
  run: bun oxfmt && bun oxlint --fix
```

なぜ: `stage_fixed` が無いと、hook が直した内容は stage されず、直す前の内容が commit される。job は `parallel: true` で同時に走るので、同じファイルを書き換える手順を別の job に分けると片方の書き込みが消える。

## glob_matcher を doublestar にし、繰り返す glob は anchor でまとめる

root の `lefthook.yml` に `glob_matcher: doublestar`（lefthook 2.0.4 以降）を書く。同じファイルの中で同じ glob を繰り返すときは YAML の anchor（`&name` / `*name`）でまとめる。anchor はファイルをまたいでは使えない。

```yaml
# Bad: 既定の matcher では **/*.tf が repo 直下の main.tf に当たらない
- name: format-terraform
  glob: "**/*.tf"
  run: terraform fmt -recursive

# Good
- name: format-terraform
  glob: &terraform-files
    - "**/*.tf"
  stage_fixed: true
  run: terraform fmt -recursive
- name: lint-terraform
  glob: *terraform-files
  run: terraform validate
```

なぜ: 既定の matcher（gobwas）の `**` は 1 階層以上のディレクトリにしか当たらず、直下のファイルが変わっても job が動かない。`doublestar` は bash と同じく 0 階層にも当たる。anchor にすると、対象を変えるときに直す場所が 1 つになる。

## job は mise タスクを呼ばず、対応するタスクと同じ生コマンドを書く

lefthook の job と CI は `mise run <task>` を呼ばず、対応する mise タスクと同じ生コマンドを書く。検査を足す・変えるときは、mise タスク・CI・lefthook を同時に直す。

```yaml
# Bad
- name: lint-ts
  run: mise run lint:ts

# Good: .config/mise/tasks/lint.toml の ["lint:ts"] と同じコマンド
- name: lint-ts
  run: bun oxlint
```

なぜ: `mise run` を経由すると、mise が既定で `mise.toml` のツールのうち入っていないものを install しようとし、hook が遅くなる。`depends` を持つタスクを hook から呼ぶと、依存タスクが二重に走ることもある。複数のコマンドを束ねたタスクを 1 つの job で呼ぶと、hook の出力には束ね全体の時間しか出ず、どのコマンドが遅いかが分からない。

## lefthook の版は mise で固定し、install は mise の install タスクから呼ぶ

lefthook は mise の `[tools]` で版を固定し、`lefthook install` は mise の `install` タスクから呼ぶ。

```toml
# mise.toml
[tools]
lefthook = "2.2.1"
```

```toml
# .config/mise/tasks/install.toml
[install]
run = [
  "mise install --locked",
  { tasks = ["install:lefthook", "install:bun"] },
]

["install:lefthook"]
description = "Install git hooks"
run = "lefthook install"
```

なぜ: 版を固定すると、手元と CI で同じ lefthook が設定を読み、`lefthook validate` の結果がそろう。install タスクから呼べば、ツールを入れる 1 つのコマンドで hook も入り、clone した直後に hook が入っていないまま commit することが無い。
