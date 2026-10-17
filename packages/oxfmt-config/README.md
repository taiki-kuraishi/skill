# @taiki-kuraishi/oxfmt-config

SKILL の規約を表す oxfmt の共有設定。

## 責務

- 実装すること: kstack の SKILL ごとの oxfmt 設定オブジェクト（利用側の `oxfmt.config.ts` で spread する）
- 実装しないこと: oxlint の設定・ルール、SKILL に書かれていない整形の好み

## SKILL と設定の対応

export する設定は SKILL の名前から `kstack-` を除いた名前にする。oxfmt の設定は整形の選択肢しか持たないので、整形の好みを決める規約だけが対象になる。

### kstack-typescript

oxfmt で表せる規約は無い。`if` の前の空行も、oxfmt が既存の空行を保つだけで挿入しないため、`@taiki-kuraishi/oxlint-config` の `kstack/blank-line-before-if` で検出する。

### kstack-layerd-architecture

oxfmt で表せる規約は無い。step 番号付きの doc と `// Step N:` コメントは oxfmt が整形するだけで、doc と本文の対応は変えられない。doc の step の有無と本文との対応は `@taiki-kuraishi/oxlint-config` の `layerdArchitecture`（`kstack/use-case-steps`）で検出する。

### kstack-monorepo

oxfmt で表せる規約は無い。Markdown は整形の選択肢しか持たず、root の README と package の README に何を書くかは決められない。

### kstack-gdscript

oxfmt で表せる規約は無い。`.gd` は oxfmt の整形対象ではない（`oxfmt --check src/player.gd` は `Expected at least one target file` になる）。

### kstack-code-comment

oxfmt で表せる規約は無い。class の method と export する関数の doc と `// Step N:` コメントは、oxfmt が整形するだけで書き足せない。例外の列挙を広げた変更には、新しい規約は無い。

### kstack-better-result

oxfmt で表せる規約は無い。整形の選択肢しか持たず、失敗を `null` で返すか `Result` の `Err` で返すかは決められない。

### kstack-git

oxfmt で表せる規約は無い。`.gitignore` は oxfmt の整形対象ではない（`oxfmt --check .gitignore` は `Expected at least one target file` になる）。

### kstack-rest-api

oxfmt で表せる規約は無い。整形の選択肢しか持たず、route が返すリソースの範囲、URL の形、request の値をどこで変換するかは決められない（3 規約の Bad / Good に `oxfmt --check` は差分を出さない）。

### kstack-testing

oxfmt で表せる規約は無い。整形の選択肢しか持たず、Arrange / Act / Assert のコメントの有無、テストデータをどこで作るか、テストの本数と assert に何を書くかは決められない（5 規約の Bad / Good に `oxfmt --check` は差分を出さない）。

### kstack-drizzle-orm

oxfmt で表せる規約は無い。整形の選択肢しか持たず、子の行を誰が消すか、cascade にするかの確認、migration の SQL を読む手順は決められない。`.sql` は oxfmt の整形対象ではない（`oxfmt --check m.sql` は `Expected at least one target file` になる）。
