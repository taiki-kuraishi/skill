# @taiki-kuraishi/oxfmt-config

SKILL の規約を表す oxfmt の共有設定。

## 責務

- 実装すること: kstack の SKILL ごとの oxfmt 設定オブジェクト（利用側の `oxfmt.config.ts` で spread する）
- 実装しないこと: oxlint の設定・ルール、SKILL に書かれていない整形の好み

## SKILL と設定の対応

export する設定は SKILL の名前から `kstack-` を除いた名前にする。oxfmt の設定は整形の選択肢しか持たないので、整形の好みを決める規約だけが対象になる。

### kstack-typescript

oxfmt で表せる規約は無い。`if` の前の空行は、oxfmt が既存の空行を保つだけで挿入しないため表せない。
