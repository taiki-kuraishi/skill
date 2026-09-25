---
name: drizzle-orm
description: 'Drizzle ORM を使う TypeScript コードを書く・修正する・レビューするときの規約。Relational Queries（db.query.<table>.findFirst / findMany）の where・orderBy の書き方、drizzle-orm への依存を DB package に閉じ込める方針、テストで drizzle の client を in-memory DB（PGlite、libsql の :memory:）に差し替えて drizzle-kit の pushSchema でスキーマを流すテクニックを扱う。drizzle-orm の import、eq / and などの演算子、repository や DB アクセス層の作成、DB を使うテストの準備（seed スクリプト、ローカル DB、テスト用 auth / repository の組み立て）、レビュー指摘への対応でも発火させる。'
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

## テストでは drizzle の client を in-memory DB に差し替える

DB を使うテストは、ローカルに立てた DB やエミュレータへ seed スクリプトで繋ぐのではなく、プロセス内の in-memory DB を client にした drizzle instance を作り、それをテスト対象へ注入する。スキーマは drizzle-kit の `pushSchema` 系 API で、アプリと同じ schema object から流す。

```ts
// Bad: 外部で起動した DB に依存し、スキーマとデータは別スクリプトで用意する
const db = drizzle(process.env.DATABASE_URL!); // 事前に `docker compose up` と `seed.sh` が必要

// Good (PostgreSQL): PGlite を client にし、schema を push する
import { PGlite } from "@electric-sql/pglite";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@acme/db/schema";

export const createTestDb = async () => {
  const client = new PGlite();
  // schema 付き instance は pushSchema の引数型に合わないため、push は素の instance で行う
  await (await pushSchema(schema, drizzle({ client }))).apply();
  return { client, db: drizzle({ client, schema }) };
};

// Good (SQLite / D1): libsql の :memory: を client にする
import { createClient } from "@libsql/client";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/libsql";

export const createTestDb = async () => {
  const db = drizzle({ client: createClient({ url: ":memory:" }), schema });
  await (await pushSQLiteSchema(schema, db)).apply();
  return db;
};
```

なぜ: 外部プロセスもコンテナも要らず、テストが自己完結して速く、並列の worker 同士も干渉しない。schema object から push するので、テストの DB がアプリの定義とずれない。差し替え点が drizzle instance 1 つなので、それを受け取る repository や auth ライブラリの drizzle adapter（better-auth の `drizzleAdapter` など）もそのまま動く。そのためテスト対象は drizzle instance を引数で受け取る形にしておく。

テストごとの初期化は driver で変える。PGlite は起動と push が重いので worker ごとに 1 回だけ作り、単一接続であることを利用して `beforeEach` で `client.exec("BEGIN")`、`afterEach` で `client.exec("ROLLBACK")` する。libsql の `execute` は `BEGIN` を次の呼び出しまで保持しないため、SQLite はテストごとに `createTestDb()` し直す（数 ms で済む）。テスト対象のコードがトップレベルで `db.transaction()` を呼ぶなら、PGlite でも作り直しを選ぶ。`drizzle-kit` はテスト専用の依存なので devDependencies に置く。
