---
name: testing
description: テストコードを書く・修正する・レビューするときの規約。spec ファイルやテスト関数を扱う場面すべてで使用すること — テスト本体に Arrange / Act / Assert のコメントを付ける構造化など。テストの新規作成、修正、レビュー指摘への対応でも発火させる。
---

# testing

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
