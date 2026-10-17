---
name: kstack-testing
description: テストコードを書く・修正する・レビューするときの規約。spec ファイルやテスト関数を扱う場面すべてで使用すること — テスト本体に Arrange / Act / Assert のコメントを付ける構造化、テストデータを seed スクリプトや共有 fixture ではなく各テストケースの Arrange で作り、beforeEach / afterEach で DB を毎回まっさらに戻す方針、テストケースの選び方（正常系 1 件と use case / HTTP 応答の振る舞いごとに 1 件、入力 validation のテストは書かない）、行われないこと（呼ばれない・insert されない・ログが出ない）を assert しない方針など。テストの新規作成、修正、ケースの追加・削減、DB を使うテストの準備、レビュー指摘への対応でも発火させる。
---

# kstack-testing

テストコードを書くときの規約。理由を理解した上で適用すること。

## テスト本体には Arrange / Act / Assert のコメントを付ける

各テストは準備・実行・検証の 3 区画に分け、それぞれ `// Arrange`、`// Act`、`// Assert` のコメントで明示する。

```ts
// Bad: 準備と検証が混ざり、何が検証対象か追いにくい
it("returns page content", async () => {
  const req = new Request("/content?id=1");
  mockDb.get.mockResolvedValue(page);
  const res = await handler(req);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(page);
});

// Good: 3 区画がコメントで明示され、テストの構造が一目で分かる
it("returns page content", async () => {
  // Arrange
  const req = new Request("/content?id=1");
  mockDb.get.mockResolvedValue(page);

  // Act
  const res = await handler(req);

  // Assert
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(page);
});
```

なぜ: コメントで区画が明示されると、「何を準備し、どの 1 動作を実行し、何を検証するか」が上から読める。複数の Act や Assert が紛れ込んだテスト（実質的に複数ケースの詰め込み）も即座に気づける。

1 つのテストに Act は 1 回、Assert はその検証に集中させる。Arrange が長くなりすぎる場合は describe や helper に切り出すことを検討する。

## テストデータはテストケース内で Arrange し、DB は毎回まっさらに戻す

テストが使うデータは seed スクリプトや `beforeAll` の共有 fixture で事前投入せず、そのテストの `// Arrange` で作る。DB は `beforeEach` / `afterEach` でテストごとに空の状態へ戻す（transaction を張って rollback する、DB を作り直すなど）。

```ts
// Bad: 事前に seed.sh が投入したユーザーを前提にし、前のテストが残した行も見えてしまう
it("admin can open settings", async () => {
  const res = await app.request("/settings", { headers: { cookie: adminCookie } });
  expect(res.status).toBe(200);
});

// Good: 毎回空の DB から始め、必要なデータはテスト内で作る
beforeEach(async () => await testDb.begin());
afterEach(async () => await testDb.rollback());

it("admin can open settings", async () => {
  // Arrange
  const admin = await createUser(testDb, { role: "admin" });

  // Act
  const res = await app.request("/settings", { headers: { cookie: await login(admin) } });

  // Assert
  expect(res.status).toBe(200);
});
```

なぜ: 前提データがテストの中に書かれていれば、そのテストだけ読めば何を検証しているか分かり、seed を変えたら無関係なテストが落ちるといった隠れた結合も生まれない。毎回空の DB から始めることで、実行順や並列実行に左右されずテストが独立する。

## テストケースは正常系 1 件と、振る舞いごとに 1 件にする

正常系を 1 件書き、use case 層や HTTP 応答の振る舞い（エラー時の応答など）を 1 つにつき 1 件書く。入力 validation（schema で弾かれる値）のテストは書かない。

```ts
// Bad: schema が弾く値を並べて validation を確かめる
it.each([{ pageSize: 5 }, { sortKey: "unknown" }])("rejects %o", async (args) => {
  const result = await client.callTool({ name: "search", arguments: args });
  expect(result.isError).toBe(true);
});

// Good: 正常系 1 件と、エラー応答という振る舞い 1 件
it("returns search results", async () => { /* ... */ });
it("returns an error when the upstream request fails", async () => { /* ... */ });
```

なぜ: validation は schema やライブラリの宣言そのものが仕様で、テストは宣言の写しになり保守コストだけが増える。振る舞いごとに 1 件にすると、どのテストが何を守っているかが名前から分かる。

## 行われないことを assert しない

「呼ばれない」「他の行に insert されない」「ログが出ない」のような、起きないことを assert しない。起きたこと（戻り値、保存された行、出たログ）を assert する。

```ts
// Bad: 正常系で、エラーログが出ないこと・他 user の行が無いことを assert する
expect(consoleErrors).toStrictEqual([]);
expect(await findPosts(otherUser.id)).toStrictEqual([]);
expect(fetchMock).not.toHaveBeenCalled();

// Good: 起きたことだけを assert する（エラー時のテストではログの中身を見る）
expect(await findPosts(user.id)).toStrictEqual([post]);
expect(consoleErrors).toStrictEqual([error]);
```

なぜ: 起きないことは無数にあり、どれを選ぶかに根拠が無い。実装を変えても落ちないテストになりやすく、守っている振る舞いが読み取れない。
