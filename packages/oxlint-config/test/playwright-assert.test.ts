import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { playwrightAssert } from "../src/rules/playwright-assert.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("playwright-assert", playwrightAssert, {
  valid: [
    // Good: E2E は URL を変える操作 1 つに 1 ケース。検証は遷移先の URL
    `import { expect, test } from "@playwright/test";

test("ログインボタンを押すと /home へ移動する", async ({ page }) => {
  // Arrange
  await page.goto("/sign-in");

  // Act
  await page.getByRole("button", { name: "ログイン" }).click();

  // Assert
  await expect(page).toHaveURL("/home");
});`,
    // 遷移しないことも `toHaveURL` で確かめる
    `import { expect, test } from "@playwright/test";

test("未ログインでは /home へ移動しない", async ({ page }) => {
  await page.goto("/home");
  await expect(page).not.toHaveURL("/home");
});`,
    // 別名の import も追う
    `import { expect as check, test } from "@playwright/test";

test("移動する", async ({ page }) => {
  await page.getByRole("button", { name: "ログイン" }).click();
  await check(page).toHaveURL("/home");
});`,
    // `test.skip` などの member も test として見る
    `import { expect, test } from "@playwright/test";

test.skip("移動する", async ({ page }) => {
  await expect(page).toHaveURL("/home");
});`,
    // Good: VRT は撮影状態を構造の locator で待ち、表示は画像で検証する
    `import { expect, test } from "@playwright/test";

// 保存に失敗したときの画面
test("save error", async ({ page }) => {
  await page.goto("/settings");
  await page.locator("main [role='alert']").waitFor();
  await expect(page).toHaveScreenshot();
});`,
    // `describe` の中の test も見る
    `import { expect, test } from "@playwright/test";

test.describe("sign-in", () => {
  // サインイン画面
  test("sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveScreenshot();
  });
});`,
    // `expect.soft` も assert として見る
    `import { expect, test } from "@playwright/test";

test("移動する", async ({ page }) => {
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect.soft(page).toHaveURL("/home");
});`,
    // テスト本体の外にある expect（helper など）は見ない
    `import { expect, test } from "@playwright/test";

const assertLoaded = (page: Page) => expect(page).toBeVisible();

test("移動する", async ({ page }) => {
  await expect(page).toHaveURL("/home");
});`,
    // @playwright/test 以外の test は見ない
    `import { expect, test } from "vitest";

test("保存する", () => {
  expect(result).toBeVisible();
});`,
    // 見逃し: custom fixture から import した test は追えない
    `import { expect, test } from "./fixtures";

test("ログイン", async ({ page }) => {
  await expect(page.getByRole("heading")).toBeVisible();
});`,
    // 見逃し: helper で撮影する VRT。toHaveScreenshot が callback に無いので、toHaveURL だけなら E2E として通す
    `import { expect, test } from "@playwright/test";

// 設定画面
test("settings page", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL("/settings");
  await capture(page);
});`,
  ],
  invalid: [
    // Bad: E2E で描画内容を expect している
    {
      code: `import { expect, test } from "@playwright/test";

test("ログイン", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("/home");
});`,
      errors: [{ messageId: "unsupported" }],
    },
    // Bad: VRT で文言を expect している
    {
      code: `import { expect, test } from "@playwright/test";

// 保存に失敗したときの画面
test("save error", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("保存に失敗しました")).toBeVisible();
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "vrt" }],
    },
    // Bad: VRT では URL も expect しない
    {
      code: `import { expect, test } from "@playwright/test";

// 保存に失敗したときの画面
test("save error", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL("/settings");
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "vrt" }],
    },
    // Bad: E2E で件数を expect している
    {
      code: `import { expect, test } from "@playwright/test";

test("一覧を表示する", async ({ page }) => {
  await page.goto("/todos");
  await expect(page.getByRole("listitem")).toHaveCount(3);
});`,
      errors: [{ messageId: "unsupported" }],
    },
    // 2 つの assert がそれぞれ指摘される
    {
      code: `import { expect, test } from "@playwright/test";

test("ログイン", async ({ page }) => {
  await expect(page).toHaveTitle("ログイン");
  await expect(page.getByRole("button")).toBeEnabled();
});`,
      errors: [{ messageId: "unsupported" }, { messageId: "unsupported" }],
    },
    // `test.describe` の中の VRT も見る
    {
      code: `import { expect, test } from "@playwright/test";

test.describe("settings", () => {
  // 設定画面
  test("settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading")).toContainText("設定");
    await expect(page).toHaveScreenshot();
  });
});`,
      errors: [{ messageId: "vrt" }],
    },
    // ヘルパーで撮影する VRT。E2E と断定せず、両方の規約を並べた汎用の指摘にする
    {
      code: `import { expect, test } from "@playwright/test";

// 設定画面
test("settings page", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading")).toBeVisible();
  await capture(page);
});`,
      errors: [{ messageId: "unsupported" }],
    },
    // 推測: toHaveScreenshot を含む test は E2E でも VRT とみなす
    {
      code: `import { expect, test } from "@playwright/test";

test("ログイン後に /home へ移動する", async ({ page }) => {
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("/home");
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "vrt" }],
    },
  ],
});
