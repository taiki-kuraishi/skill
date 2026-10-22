---
name: kstack-readme
description: README（repo root の README.md と、monorepo の app・package の README.md）を書く・修正する・レビューするときの規約。root README には repo の名前・数行の概要・install と使い方の入口（install の 1 コマンドと最小の例 1 つ、詳しい手順は package の README へのリンク）・license だけを書き、構成表・テスト手順・詳しいセットアップを書かないこと、package の README に責務 section（実装すること / 実装しないこと）と使い方・セットアップ・テスト手順を書き、コードを読めば分かる実装の詳細を書かないこと、agent 向けの指示やコードを書く側の規約とすぐ古くなる数値や一覧を書かず、使い方・API 利用契約は README に残すこと、日本語で書き upstream から取り込んだ README は原文のまま残すことを扱う。package の新設、機能の実装やレビュー指摘への対応のついでに README を更新する場面でも発火させる。
---

# kstack-readme

README を書くときの規約。理由を理解した上で適用すること。package の新設と責務に合わない処理の置き場所は kstack-monorepo、agent 向けの指示の書き方は kstack-agents-md の SKILL を参照。

## root README には名前・概要・使い方の入口・license だけを書く

root の README には repository の名前、数行の概要、install と使い方の入口、license を書く。使い方の入口は install の 1 コマンドと最小の例 1 つにし、詳しい手順は app / package の README へのリンクにする。構成表・テスト手順・詳しいセットアップは root に書かず、それを持つ app / package の README に置く。

````md
<!-- Bad: package の中身や手順を root に写している -->

# acme

## 構成

| path          | 内容 |
| ------------- | ---- |
| packages/core | ...  |

## テスト

cd packages/core && ...

<!-- Good: 入口だけを書き、詳細は package の README へ -->

# acme

Markdown を HTML に変換する CLI。

## 使い方

```sh
bun add -g acme
acme README.md > README.html
```

オプションは [packages/cli の README](packages/cli/README.md) を参照。

## License

MIT
````

なぜ: 構成や手順は package ごとに変わるので、root に写すと package の README と二重管理になり、片方だけ更新されて食い違う。install と最小の例が無いと、root を開いた人は使い始めるまでに package の README を探し回る。

## package の README に責務 section を置く

各 package の README に「責務」section を作り、その package で実装すること・実装しないことを書く。package を新設したら同時に書く。

```md
<!-- Bad: 中身の紹介だけで、何を置かないかが分からない -->

# @acme/db

DB のスキーマと migration。

<!-- Good: 置くものと置かないものを並べる -->

# @acme/db

## 責務

- 実装すること: ORM の schema、migration、DB client の生成
- 実装しないこと: ドメインロジック、値の変換・正規化、DB を使わない関数
```

なぜ: 「実装しないこと」が無いと、共有 package は app をまたいで import できる置き場として何でも受け入れ、責務と依存が膨らんでいく。

## package の README には使い方・セットアップ・テスト手順を書き、実装の詳細は書かない

package の README には、責務に加えて使い方・セットアップ・テスト手順を書く。コードを読めば分かる実装の詳細（内部のファイルと関数の説明、処理の流れ）は書かない。

```md
<!-- Bad: 実装を要約している -->

## 実装

- `src/client.ts` — `createClient` が接続プールを作り、`withTransaction` で包む

<!-- Good: 使う人が手を動かす手順を書く -->

## セットアップ

`.env` に `DATABASE_URL` を書き、`bun run migrate` を実行する

## テスト

`bun test`
```

なぜ: 実装の要約はコードを変えても追従せず、読んだ人が古い前提で作業する。必要な環境変数やコマンドはコードに散らばっているので、README に無いと使う人が探し回る。

## agent 向けの指示と、すぐ古くなる数値・一覧を書かない

agent 向けの指示（作業手順、user の承認が要る操作）や、コードを書く側が守る規約は README に書かない。コードから読み取れないプロジェクト共通の決まりは AGENTS.md（kstack-agents-md）、そのコード固有の理由はコードコメント（kstack-code-comment）に置く。使い方・API 利用契約は README に残す。テストの件数、ファイルや endpoint の一覧のように、変更のたびに変わる数値や一覧も書かない。

```text
Bad: README に「agent は commit の前に user に diff を見せること」「updated_at は書き手が書く」というコードを書く側の規約、「テストは 117 件」「endpoint は次の 12 個」と書く
Good: 指示やコードから読めない共通の決まりは AGENTS.md、コード固有の理由はコードコメントに置き、README には API の呼び出し方・利用契約や `bun test` のような手順を書く
```

なぜ: コードを書く側の決まりは作業前に読む AGENTS.md、コード固有の理由はそのコードのそばに置くと読み落とされにくい。使う側の契約まで移すと利用者が困り、数値や一覧は変更のたびに古くなって事実と食い違う。

## 日本語で書き、upstream から取り込んだ README は原文のまま残す

README は日本語で書く。upstream から取り込んだ README（scaffold が生成したもの、skills add で入れた skill の README など）は訳さず、原文のまま残す。

```text
Bad: repo で書いた package の README を英語で書く / create-vite が生成した README を日本語に訳して書き換える
Good: repo で書いた README は日本語で書き、生成・取り込んだ README は原文のまま残す
```

なぜ: user が読んで review する文書なので、user の言葉で書かないと読み流される。取り込んだものを訳すと、upstream の更新を取り込むたびに訳文と衝突して同期できなくなる。
