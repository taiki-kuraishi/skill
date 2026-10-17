---
name: kstack-drizzle-orm
description: "Drizzle ORM を使う TypeScript コードを書く・修正する・レビューするときの規約。Relational Queries（db.query.<table>.findFirst / findMany）の where・orderBy の書き方、drizzle-orm への依存を DB package に閉じ込める方針、親の行を消すときに子テーブルを外部キー（references）の onDelete cascade で消させる書き方と、cascade にするかを user に確認する手順、SQLite / Cloudflare D1 で既存の外部キーを変える migration の注意、テストで drizzle の client を in-memory DB（PGlite、libsql の :memory:）に差し替えて drizzle-kit の pushSchema でスキーマを流すテクニックを扱う。drizzle-orm の import、eq / and などの演算子、repository や DB アクセス層の作成、削除 API・関連レコードの削除、schema の外部キー定義と drizzle-kit generate の migration、DB を使うテストの準備（seed スクリプト、ローカル DB、テスト用 auth / repository の組み立て）、レビュー指摘への対応でも発火させる。"
---

# kstack-drizzle-orm

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

## 親を消すときの子の行は、外部キーの onDelete で DB に消させる

親の行を消すと決まったら、子テーブルを route や repository で順に delete しない。schema の `references` に `onDelete: "cascade"` を書き、親 1 行を消すだけにする。

```ts
// Bad: 子テーブルを先に手で消している
await db.delete(comments).where(eq(comments.post_id, postId));
await db.delete(posts).where(eq(posts.id, postId));

// Good: schema に cascade を書き、親だけを消す
export const comments = sqliteTable("comments", {
  id: text().primaryKey(),
  post_id: text()
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
});

await db.delete(posts).where(eq(posts.id, postId));
```

なぜ: 子テーブルが増えても削除コードを直さずに済み、消し忘れで孤立した行や外部キー違反が残らない。DB が 1 文で消すので、途中で失敗して一部だけ消えた状態にもならない。

親を消したときに子をどうするか（`cascade` で消す、`restrict` で親の削除を止める、`set null` で残す、論理削除にする）は要件なので、agent が決めない。関連データを消してよいかを user に確認し、承認を得てから `cascade` にする。cascade で消えた行は戻せない。

既存の外部キーの `onDelete` を変える migration は、データのある環境に流す前に生成された SQL を読む。SQLite は外部キーを ALTER できないので、drizzle-kit は `PRAGMA foreign_keys=OFF` → 新しいテーブルを作ってコピー → 元のテーブルを DROP → rename、という migration を生成する。Cloudflare D1 はクエリを暗黙のトランザクションで動かすので `PRAGMA foreign_keys=OFF` が効かず、親のテーブルの DROP で子の行が cascade で消えるか、制約違反で失敗する。作り直したテーブルは rowid も振り直される。本番データがあるなら、手書きの migration（バックアップ用のテーブルを経由して移すなど）と流す手順を user と決める。

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
