---
name: kstack-monorepo
description: monorepo の workspace package（packages/* など）にコードを足す・package を新設する・修正する・レビューするときの規約。コードを足す前に package の README の責務と照らすこと、責務に合わない処理を既存 package に相乗りさせず package を新設すること、責務の変更に user の承認を取ることを扱う。app 間で共有したい関数・型の置き場所に迷う場面、DB package などの共有 package への export や dependencies の追加、レビュー指摘への対応でも発火させる。README の書き方は kstack-readme が扱う。
---

# kstack-monorepo

monorepo の workspace package を扱うときの規約。理由を理解した上で適用すること。README の規約は `skill://kstack-readme` を読む。

## 責務に合わない処理は package を新設して置く

既存 package にファイルや export を足す前に、README の責務 section（kstack-readme）と照らす。当てはまらない処理は既存 package に相乗りさせず、責務を名前にした package を新設して置く。

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
