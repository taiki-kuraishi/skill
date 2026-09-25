---
name: better-auth
description: better-auth を使うアプリのテストを書く・修正する・レビューするときの規約。testUtils plugin 付きのテスト用 better-auth instance と in-memory DB（drizzle + PGlite など）のライフサイクルを TestAuthDatabase class に閉じ込め、テストケースの Arrange で user を作り、その cookie や認証ヘッダーで Playwright の E2E や API テストを行う書き方を扱う。ログイン済み前提のテスト、セッションや cookie の用意、betterAuth / drizzleAdapter / testUtils / getCookies / getAuthHeaders を含むテストヘルパーの作成、レビュー指摘への対応でも発火させる。
---

# better-auth

better-auth を使うアプリをテストするときの規約。理由を理解した上で適用すること。DB を in-memory に差し替える手順は drizzle-orm の SKILL を参照。

## テスト用 instance と DB のライフサイクルを 1 つの class に閉じ込める

`testUtils()` plugin を足したテスト用の better-auth instance と、それが使う DB を `TestAuthDatabase` class にまとめる。spec ファイルからはライフサイクルの呼び出しと、user を作る API だけが見える形にする。

```ts
// Bad: spec ごとに DB と instance を組み立て、片付けも各所に散る
test.beforeAll(async () => {
  client = new PGlite();
  db = drizzle({ client, schema });
  await (await pushSchema(schema, db)).apply();
  auth = betterAuth({ ...config, database: drizzleAdapter(db, { provider: "pg", schema }) });
});

// Good: 組み立てと片付けは class の中にある
export class TestAuthDatabase {
  private readonly client = new PGlite();
  private readonly db = drizzle({ client: this.client, schema });
  // 本番の config を土台に、テストに要るものだけ上書きする
  readonly auth = betterAuth({
    ...config,
    baseURL: "http://localhost:3000",
    secret: "test-secret-0123456789abcdef0123456789",
    database: drizzleAdapter(this.db, { provider: "pg", schema }),
    plugins: [...config.plugins, testUtils()],
  });

  async setup() {
    // schema 付き instance は pushSchema の型に合わないので、素の instance で push する
    await (await pushSchema(schema, drizzle({ client: this.client }))).apply();
  }

  async begin() {
    await this.client.exec("BEGIN");
  }

  async rollback() {
    await this.client.exec("ROLLBACK");
  }

  async testHelpers() {
    return (await this.auth.$context).test;
  }
}
```

```ts
// spec 側: ライフサイクルは beforeAll / beforeEach / afterEach に 1 行ずつ
const testAuth = new TestAuthDatabase();
test.beforeAll(async () => await testAuth.setup());
test.beforeEach(async () => await testAuth.begin());
test.afterEach(async () => await testAuth.rollback());
```

なぜ: DB の作成、スキーマの push、instance の生成、rollback の順序は間違えやすく、spec ごとに書くとずれていく。class に閉じ込めれば、spec はテストしたい振る舞いだけを書ける。DB と instance を field 初期化子で作れば `undefined` を確かめるコードも要らない。`testUtils()` は本番の config ではなく、テスト用 instance にだけ足す。本番の plugin 構成を土台にすれば、テストと本番で認証の挙動が変わらない。

## テストケースの Arrange で user を作り、その認証情報でテストする

ログイン済みが前提のテストは、ログイン画面を操作したり seed 済みの固定 user を使ったりしない。testUtils で user を作って保存し、その user の cookie（ブラウザ）や認証ヘッダー（API）を渡す。

```ts
// Bad: 毎回ログイン UI を通り、seed 済みの user に依存する
await page.goto("/sign-in");
await page.getByLabel("Email").fill("admin@example.com");

// Good: user を作り、cookie を browser context に入れる
test("admin は /users を開ける", async ({ context, page }) => {
  // Arrange
  const t = await testAuth.testHelpers();
  const user = await t.saveUser(t.createUser({ role: "admin" })); // role は admin plugin の列
  await context.addCookies(await t.getCookies({ userId: user.id, domain: "localhost" }));

  // Act
  await page.goto("/users");

  // Assert
  await expect(page).toHaveURL("/users");
});

// API テストでは cookie の代わりにヘッダーを使う
const headers = await t.getAuthHeaders({ userId: user.id });
```

なぜ: ログイン UI の検証はログイン画面のテストの役割で、ほかのテストが毎回そこを通ると遅くなり、無関係な変更で落ちる。user をテスト内で作れば、role などの属性の違いが Arrange に書かれ、テスト名と前提が一緒に読める。

`getCookies` の `domain` は、ブラウザが開くアプリの host に合わせる。テスト対象のサーバーがこの instance（とその DB）で session を検証できるようにしておく必要がある。同じプロセスで動くアプリなら DI で instance を渡す。ブラウザから別 origin の認証 API を叩く構成なら、その URL へのリクエストを `page.route` や MSW で `testAuth.auth.handler(request)` に流す。
