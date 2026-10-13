---
name: kstack-monorepo
description: monorepo の workspace package（packages/* など）にコードを足す・package を新設する・修正する・レビューするときの規約。package の README に責務 section（実装すること / 実装しないこと）を置くこと、root README は見出しと概要だけにして構成表・テスト手順を package の README に置くこと、コードを足す前に責務と照らすこと、責務に合わない処理を既存 package に相乗りさせず package を新設すること、責務の変更に user の承認を取ることを扱う。app 間で共有したい関数・型の置き場所に迷う場面、README の作成・修正、DB package などの共有 package への export や dependencies の追加、レビュー指摘への対応でも発火させる。
---

# kstack-monorepo

monorepo の workspace package を扱うときの規約。理由を理解した上で適用すること。

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

## root README は見出しと概要だけにする

root の README には repository の名前と数行の概要だけを書く。構成表・セットアップ・テスト手順は、それを持つ app / package の README に置く。

```md
<!-- Bad: package の中身や手順を root に写している -->

# acme

## 構成

| path          | 内容 |
| ------------- | ---- |
| packages/core | ...  |

## テスト

cd packages/core && ...

<!-- Good: 概要だけ。詳細は各 package の README へ -->

# acme

ブラウザで遊ぶクリッカーゲーム。
```

なぜ: 構成や手順は package ごとに変わるので、root に写すと package の README と二重管理になり、片方だけ更新されて食い違う。

## 責務に合わない処理は package を新設して置く

既存 package にファイルや export を足す前に、README の責務 section と照らす。当てはまらない処理は既存 package に相乗りさせず、責務を名前にした package を新設して置く。

```ts
// Bad: app 間で共有したい URL 正規化を、既にある DB package から export する
// packages/db/src/index.ts
export * from "./schemas";
export * from "./normalize-url"; // URL 解析ライブラリへの依存も DB package に入る

// Good: 責務ごとの package を新設し、DB package は schema と migration に留める
// packages/url/src/index.ts
export const normalizeUrl = (url: string) => {
  /* ... */
};
```

なぜ: app 間で共有するには package に置くしかないが、それは既存 package に入れる理由にならない。相乗りすると、その package に依存する app すべてが無関係な処理と依存ライブラリまで抱え、package 名から中身を推測できなくなる。

責務 section 自体を変えたいときは、コードを足す前に変更案として user の承認を取る。責務 section はコードを足す側が自分で編集できるため、書き換えや「例外」の注記で通すと規約が無いのと同じになる。
