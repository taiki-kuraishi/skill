# @taiki-kuraishi/oxlint-config

SKILL の規約を表す oxlint の共有設定と、自作ルールの JS plugin。

## 責務

- 実装すること: kstack の SKILL ごとの oxlint 共有設定（`extends` に渡す設定オブジェクト）と、既存ルールで表せない規約の自作ルール（JS plugin）
- 実装しないこと: oxfmt の設定、SKILL に書かれていない規約、型情報を使うルール（oxlint の JS plugin は型情報を使えない）

## SKILL と設定の対応

export する設定は SKILL の名前から `kstack-` を除いた名前にする。表せない規約は、lint で守れないのでレビューで確かめる。

### kstack-typescript（`typescript`）

| 規約                                                | ルール / 表せない理由                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| else・三項演算子を使わない。早期 return する        | `no-else-return`（`allowElseIf: false`）、`no-ternary`。return しない `if` の `else` は検出しない |
| 小さすぎる処理を関数化しない                        | 表せない。「小さい」「名前に意味がある」を構文から決められない                                    |
| 各メソッドで繰り返す依存の生成は constructor に置く | 表せない。依存の生成と同じ関数の呼び出しを構文から区別できない                                    |
