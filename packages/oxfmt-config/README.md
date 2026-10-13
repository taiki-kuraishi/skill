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

oxfmt で表せる規約は無い。step 番号付きの doc と `// stepN:` コメントは oxfmt が整形するだけで、doc と本文の対応は変えられない。doc の step の有無と本文との対応は `@taiki-kuraishi/oxlint-config` の `layerdArchitecture`（`kstack/use-case-steps`）で検出する。

### kstack-monorepo

oxfmt で表せる規約は無い。Markdown は整形の選択肢しか持たず、root の README と package の README に何を書くかは決められない。

### kstack-gdscript

oxfmt で表せる規約は無い。`.gd` は oxfmt の整形対象ではない（`oxfmt --check src/player.gd` は `Expected at least one target file` になる）。

### kstack-code-comment

例外の列挙を広げただけで、新しい規約は無い。oxfmt の設定は作らない。
