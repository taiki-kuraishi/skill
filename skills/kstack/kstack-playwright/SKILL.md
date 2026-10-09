---
name: kstack-playwright
description: Playwright（@playwright/test）でブラウザテストを書く・修正する・レビューするときの規約。VRT（ビジュアルリグレッションテスト、toHaveScreenshot）と E2E テストの置き場所・実行環境・assert 対象の分け方、E2E のテストケース粒度（URL を変える操作単位、toHaveURL での検証）を扱う。spec ファイルの新規作成、テスト追加先の判断、playwright config の作成、レビュー指摘への対応でも発火させる。
---

# kstack-playwright

Playwright でブラウザテストを書くときの規約。理由を理解した上で適用すること。

## VRT と E2E はディレクトリも config も分ける

VRT はスクリーンショットを assert するテストだけを置く。画面遷移や振る舞いを検証するテストは `test/e2e` のような別ディレクトリに置き、別の playwright config で実行する。

```ts
// Bad: test/vrt/sign-in.spec.ts に、スクリーンショットを撮らない遷移テストが混ざっている
test("ログイン後に callbackURL へ移動する", async ({ page }) => {
  await page.goto("/sign-in?callbackURL=https://app.example/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("https://app.example/");
});

// Good: test/e2e/sign-in.spec.ts に置き、e2e 用の config で実行する
```

なぜ: 「VRT」と名の付く場所にあるテストは、スクリーンショット差分で失敗するものだと読み手は期待する。種類が混ざると、失敗時に見るべきもの（画像差分か遷移先か）と更新手順（`--update-snapshots` の要否）が分からなくなる。

## Docker を使うのは VRT だけ

VRT はフォントやレンダリングの差でスクリーンショットが揺れるため、Docker で実行環境を固定する。E2E は画素を比べないので Docker を使わず、ホストで直接実行する。

```ts
// Bad: e2e.playwright.config.ts が VRT と同じく Docker 内のブラウザ前提になっている

// Good: e2e.playwright.config.ts はホストのブラウザで動かし、Docker 前提の設定は vrt 側の config にだけ書く
```

なぜ: 環境固定が必要なのは画像比較のためだけ。E2E まで Docker 前提にすると、起動が遅くなりローカルで気軽に回せなくなるだけで、得るものがない。

## E2E は URL を assert し、テストケースは URL を変える操作単位にする

E2E の Assert は `toHaveURL` による遷移先の検証を主にする。テストケースは「この操作をすると、この URL へ移動する（しない）」という、URL を変える操作 1 つにつき 1 ケースで切る。

```ts
// Bad: 描画内容の確認と複数の遷移を 1 ケースに詰め込み、見た目の検証も混ぜている
test("sign-in", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("/home");
  await page.getByRole("link", { name: "ログアウト" }).click();
  await expect(page).toHaveURL("/sign-in");
});

// Good: URL を変える操作 1 つに 1 ケース。検証は遷移先の URL
test("ログインボタンを押すと /home へ移動する", async ({ page }) => {
  // Arrange
  await page.goto("/sign-in");

  // Act
  await page.getByRole("button", { name: "ログイン" }).click();

  // Assert
  await expect(page).toHaveURL("/home");
});
```

なぜ: 見た目の検証は VRT の役割で、E2E が担うのは「ユーザーの操作でどこへ行くか」。URL を変える操作単位で切れば、テスト名がそのまま画面遷移の仕様一覧になり、失敗したときにどの遷移が壊れたか即座に分かる。
