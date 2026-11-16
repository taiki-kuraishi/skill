---
name: kstack-mise-tasks
description: "mise のタスク定義（mise.toml の [tasks]、.config/mise/tasks/*.toml の TOML タスク、monorepo の config_roots と //<path>:<task>）を分割して書く規約。root の mise.toml に設定だけを置いてタスクを .config/mise/tasks/ に入口ごとのファイルで書くこと、1 つの package・app に閉じるタスクをそのディレクトリの mise.toml に置くこと、タスクを作る基準、run の要素と引数（usage）、並列化（depends・{ tasks = [...] }）、Tera の raw、secrets、description に使い方を書くこと、format と lint の分担を扱う。mise タスクを追加・修正・分割・整理・レビューするとき、Makefile や package.json の scripts から mise タスクへ移すときにも発火させる。"
---

# kstack-mise-tasks

[mise のタスク](https://mise.jdx.dev/tasks/)を分割して定義するときの規約。理由を理解した上で適用すること。CI の `jdx/mise-action` の規約は `kstack-mise-actions` に、lefthook の job からタスクと同じ検査を回す規約は `kstack-lefthook` にある。

## root の mise.toml には設定だけを書き、タスクは .config/mise/tasks/ に入口ごとのファイルで書く

root の `mise.toml` には `[tools]`・`[env]`・`[settings]`・`[monorepo]` などの設定だけを書き、`[tasks]` を書かない。root のタスクは `.config/mise/tasks/` に TOML タスク（`tasks.` を付けずにタスクを並べたファイル）で書く。入口のタスク 1 つにつき 1 ファイルにし、子タスクは親と同じファイルに置く。大きくなったら入口の名前のディレクトリを 1 階層だけ作って分け（`lint:ts` は `lint/ts.toml` に置き、キーは `["lint:ts"]` のまま書く）、それより深くしない。

```toml
# Bad: mise.toml に設定とタスクが混ざっている
[tools]
bun = "1.4.2"

[tasks.lint]
depends = ["lint:ts", "lint:md"]

[tasks."lint:ts"]
run = "bun oxlint"
```

```toml
# Good: .config/mise/tasks/lint.toml に入口と子タスクを置く
[lint]
description = "Lint TypeScript and Markdown"
depends = ["lint:ts", "lint:md"]

["lint:ts"]
description = "Lint TypeScript"
run = "bun oxlint"

["lint:md"]
description = "Lint Markdown"
run = "markdownlint-cli2"
```

なぜ: `.config/mise/tasks/` は mise が既定で読むディレクトリなので、登録の設定が要らず、ツールの版を変える差分とタスクを変える差分が別のファイルになる。タスク名は path でなく TOML のキーで決まり、同じ名前を 2 か所に書くと警告なしにどちらかが勝ち、同じディレクトリのファイルの間ではどちらが勝つかも保証されないので、入口の名前からファイルが 1 つに決まるようにしておく。

## 1 つの package・app に閉じるタスクは、そのディレクトリの mise.toml に書く

1 つの package・app の中だけで動くタスクは、そのディレクトリの `mise.toml` に `[tasks.*]` で書く。root の `mise.toml` に `monorepo_root = true` を書き、そのディレクトリを `[monorepo] config_roots` に入れる。呼び出しは `//<path>:<task>`、まとめて回すときは `//apps/...:test`、config root の中から root のタスクを呼ぶときは `//:<task>` にする。一覧は `mise tasks --all` で見る。

```toml
# Bad: root のタスクから package のディレクトリに入って動かす
# .config/mise/tasks/test.toml
["test:web"]
dir = "{{config_root}}/apps/web"
run = "bun vp test"
```

```toml
# Good: mise.toml
monorepo_root = true

[monorepo]
config_roots = ["apps/*"]
```

```toml
# Good: apps/web/mise.toml
[tasks.test]
description = "Run web tests"
run = "bun vp test"
```

```toml
# Good: .config/mise/tasks/test.toml
[test]
description = "Run tests of every app"
depends = ["//apps/...:test"]
```

なぜ: config root のタスクは cwd がそのディレクトリになり、app を足しても root のタスクを書き換えずに `//apps/...:test` が拾う。`config_roots` を書かないと、mise は廃止予定のディレクトリ探索で config root を探し、警告を出す。config root の中では名前だけのタスクがその config root のものとして探されるので、root のタスクは `//:` を付けないと見つからない。root の `mise tasks` には config root のタスクが出ないので、一覧には `--all` を付ける。

## タスクは、mise が足すものがあるときだけ作る

タスクを作るのは、次のどれかに当てはまるときだけにする。

- 複数のコマンドを束ねる入口
- 先に起動しておく別タスク（サーバーなど）を `depends` に持つ
- 分岐・ループ・`trap`・パイプなどの制御構造を持つ
- `secrets` で秘密を受け取る
- 入口から並列に回すために切り出した子タスク
- `lock` で worktree をまたいで排他する（固定の port を使うテストなど）

```toml
# Bad: 1 つのコマンドに名前を付けただけ
[oxlint]
run = "bun oxlint"
```

なぜ: 別名だけのタスクは、コマンドを読むのに参照を 1 段増やすだけで、mise が足すもの（実行順・並列・秘密・排他）が無い。タスクが増えるほど、`mise tasks` から入口を探しにくくなる。

## run は 1 要素に 1 コマンドで書き、引数は usage で受け取る

`run` はコマンドを 1 つずつリストに書く。shebang の無い要素はそれぞれ別の `sh -o errexit -c` で順に動き、変数は要素をまたがない。変数や分岐を共有する手順だけ複数行の 1 要素にし、bash の機能（`[[ ]]`・`pipefail` など）が要る要素は 1 行目を `#!/usr/bin/env bash`、2 行目を `set -euo pipefail` にする。引数を途中で使う・検査するタスクは、`usage` で `arg` / `flag` を宣言し、本体で `$usage_<name>` として読む。

```toml
# Bad: 要素をまたいで変数を使い、位置引数に頼る
[deploy]
run = [
  "TARGET=$1",
  "bun vp run build",
  "wrangler deploy --env $TARGET",
]
```

```toml
# Good: 引数を usage で宣言する
[deploy]
description = "Build and deploy the worker"
usage = 'arg "<env>" help="Target environment"'
run = [
  "bun vp run build",
  "wrangler deploy --env $usage_env",
]
```

なぜ: 要素をまたいだ変数は空になる。shebang を付けた要素は errexit で動かないので、`set -e` が無いと途中のコマンドが失敗しても先へ進み、タスクが成功して見える。`mise run <task> -- <args>` の引数は、shebang の無い要素では `$1` に入らず、最後のコマンドの末尾に付くだけなので、途中で使うと空のまま動く。`usage` で宣言すると、数の検査と `--help` を mise が行う。

## 書き込み先が重ならない手順は並列に回し、同じファイルを書き換える手順は順に回す

書き込み先が重ならない手順は子タスクに分け、`depends` か `run` の `{ tasks = [...] }` で並列に回す。同じファイルを書き換える手順（formatter と `--fix` など）は、1 つの `run` のリストで順に回す。

```toml
# Bad: 同じファイルを書き換える手順を並列に回す
[format]
depends = ["format:oxfmt", "format:oxlint-fix"]
```

```toml
# Good: 前提の手順の後に並列にし、同じファイルを書き換える手順は順に回す
[lint]
run = [
  "bun install --frozen-lockfile",
  { tasks = ["lint:ts", "lint:md"] },
]

[format]
run = ["bun oxfmt", "bun oxlint --fix"]
```

なぜ: `depends` と `{ tasks = [...] }` の中は順序なしで同時に動くので、同じファイルを書き換える手順を並べると片方の書き込みが消える。重ならない手順まで 1 つのリストに並べると、待つ必要の無い手順を待つ。

## run の中のほかのツールの {{ }} は raw で囲む

`run` は mise の Tera テンプレートとして展開されるので、docker の Go テンプレートのような `{{ }}` は `{% raw %}…{% endraw %}` で囲む。

```toml
# Bad
run = "docker inspect -f '{{.State.Running}}' db"

# Good
run = "docker inspect -f '{% raw %}{{.State.Running}}{% endraw %}' db"
```

なぜ: 囲まないと mise が `{{ }}` を自分のテンプレートとして展開しようとし、構文エラーになるか、別の値に置き換わる。

## 秘密はタスクの secrets で受け取る

秘密はタスクの `secrets = [...]` で受け取る（別の名前で受け取るときは `env = { X = "{{ secrets.Y }}" }`）。供給元の設定（`[secrets.fnox]` など）は root の `mise.toml` に 1 つだけ書き、config root の `mise.toml` には書かない。タスクの中で供給元の CLI（`fnox exec` など）を呼ばない。mise の `secrets` は experimental なので、`[settings] experimental = true` と、対応する `min_version` が要る。

```toml
# Bad: apps/api/mise.toml
[secrets.fnox]

[tasks.migrate]
run = "fnox exec -- bun run migrate"
```

```toml
# Good: apps/api/mise.toml
[tasks.migrate]
description = "Apply database migrations"
secrets = ["DATABASE_URL"]
run = "bun run migrate"
```

なぜ: `secrets` で受け取ると mise が値を知っているので、そのタスクの出力から値を伏せ、依存タスクには渡さない。タスクの中で CLI から読むと、mise は値を知らず出力を伏せられない。供給元を root の 1 か所に置けば、どの config root のタスクも同じ設定で受け取れる。

## タスクの使い方は description と usage に書き、README・AGENTS.md に一覧を並べない

タスクの目的・引数・前提（要る認証など）は `description` と `usage` に書き、一覧は `mise tasks --all` で見る。README・AGENTS.md には、タスクの一覧や、中身・引数・オプションの説明を並べない。README でタスクに触れるのは環境構築の手順（`mise run install` など）だけにし、AGENTS.md では承認や認証が要る操作の手順の中で、実行するタスク名を出すだけにする（`kstack-readme`・`kstack-agents-md`）。

```toml
# Bad: description が無く、-u の使い方が README にしか書かれていない
["test:vrt"]
run = "bun playwright test"

# Good
["test:vrt"]
description = "Compare VRT snapshots; -- -u updates changed snapshots"
run = "bun playwright test"
```

なぜ: README・AGENTS.md に並べた一覧や引数の説明は、タスクの追加・改名で古くなっても気づかれない。`description` はタスクと同じ場所にあり、`mise tasks` にそのまま出る。環境構築の入口と、承認の要る操作がどのタスクかは一覧を見ても分からないので、その手順の中でだけ名前を出す。

## 自動修正は format 側だけで行い、lint は検査だけにする

`--fix` や `--write` のようにファイルを書き換える手順は `format` 系のタスクに置き、`lint` 系のタスクは検査だけにする。

```toml
# Bad
["lint:ts"]
run = "bun oxlint --fix"

# Good
["lint:ts"]
run = "bun oxlint"

[format]
run = ["bun oxfmt", "bun oxlint --fix"]
```

なぜ: lint が直せる違反を黙って直すと、違反を書いても気づかないまま通り、規約の強制が効かなくなる。検査と書き換えを分けると、lint はどこで回しても作業ツリーを変えない。
