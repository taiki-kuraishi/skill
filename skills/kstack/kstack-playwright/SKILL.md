---
name: kstack-playwright
description: Playwright（@playwright/test）でブラウザテストを書く・修正する・レビューするときの規約。VRT（ビジュアルリグレッションテスト、toHaveScreenshot）と E2E テストの置き場所・実行環境・assert 対象の分け方、VRT のテスト名（英語で書き、日本語はコメントで添える）、E2E のテストケース粒度（URL を変える操作単位、Assert は toHaveURL のみ）、VRT の Assert は toHaveScreenshot のみとし構造を使った locator.waitFor で撮影状態を待つことを扱う。spec ファイルの新規作成、テスト追加先の判断、playwright config の作成、レビュー指摘への対応でも発火させる。
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

## VRT のテスト名は英語で書き、日本語はコメントで添える

VRT の `test` / `describe` の第 1 引数は英語で書き、`test` の上の行に日本語のコメントで内容を書く。

```ts
// Bad
test("サインイン画面", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});

// Good
// サインイン画面
test("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});
```

なぜ: `toHaveScreenshot()` はテスト名からスナップショットのファイル名を作るので、日本語の名前はファイル名にも日本語が入る。日本語はコメントに残せば、何を撮るテストかは読める。

## E2E は URL を assert し、テストケースは URL を変える操作単位にする

E2E の Assert は `toHaveURL` だけにする。文言・要素の有無・件数を `toHaveText`・`toBeVisible`・`toHaveCount` などで expect せず、表示の検証は VRT に任せる。locator を `click`・`fill` などの操作に使うのはよい。テストケースは「この操作をすると、この URL へ移動する（しない）」という、URL を変える操作 1 つにつき 1 ケースで切る。

```ts
// Bad: 描画内容の確認と複数の遷移を 1 ケースに詰め込み、見た目の検証も混ぜている
test("ログイン", async ({ page }) => {
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

## VRT の Assert は toHaveScreenshot だけにする

表示される文言や要素の表示を別の expect で重複検証しない。撮影する状態までの待機は、要素の構造を使った `locator.waitFor()` で行う。

```ts
// Bad: スクリーンショットと同じ表示を文言でも検証している
await expect(page.getByText("保存に失敗しました")).toBeVisible();
await expect(page).toHaveScreenshot();

// Good: 構造で撮影状態を待ち、表示は画像で検証する
await page.locator("main [role='alert']").waitFor();
await expect(page).toHaveScreenshot();
```

なぜ: 文言や要素の表示はスクリーンショットにも写る。同じ表示を二重に検証すると、表示を変えるたびに画像と expect の両方を直すことになる。
