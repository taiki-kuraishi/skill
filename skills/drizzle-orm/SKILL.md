---
name: drizzle-orm
description: Drizzle ORM を使う TypeScript コードを書く・修正する・レビューするときの規約。Relational Queries（db.query.<table>.findFirst / findMany）の where・orderBy の書き方と、drizzle-orm への依存を DB package に閉じ込める方針を扱う。drizzle-orm の import、eq / and などの演算子、repository や DB アクセス層の作成、レビュー指摘への対応でも発火させる。
---

# drizzle-orm

[Drizzle ORM](https://orm.drizzle.team/docs/rqb) を書くときの規約。理由を理解した上で適用すること。

## Relational Queries では drizzle-orm から演算子を import しない

`db.query.<table>.findFirst` / `findMany` の `where` や `orderBy` は、`drizzle-orm` から `eq` / `and` を import して組み立てず、Relational Queries が用意する書き方を使う。

```ts
// Bad: アプリ側が drizzle-orm に直接依存し、table object を直接参照している
import { and, eq } from "drizzle-orm";
import { users } from "@acme/db";

await db.query.users.findFirst({
  where: and(eq(users.orgId, orgId), eq(users.role, "admin")),
});

// Good (v0.x): callback が渡す column と operators を使う
await db.query.users.findFirst({
  where: (t, { and, eq }) => and(eq(t.orgId, orgId), eq(t.role, "admin")),
});

// Good (v1): object 記法で書く。キーの並びは AND になる
await db.query.users.findFirst({
  where: { orgId, role: "admin" },
});
```

なぜ: 演算子を import しなければ、アプリ側のコードは `drizzle-orm` を知らずに済み、ORM への依存を schema と client を持つ DB package に閉じ込められる。ORM の更新や差し替えの影響がその package の中で完結する。加えて callback の column は query scope に合わせて alias された table を指すため、ネストや自己参照の query でも正しい SQL になる。

使っている drizzle-orm の major version を `package.json` で確かめ、v0.x なら callback、v1 なら object 記法を選ぶこと。
