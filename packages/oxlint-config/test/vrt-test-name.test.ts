import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { vrtTestName } from "../src/rules/vrt-test-name.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("vrt-test-name", vrtTestName, {
  valid: [
    // Good: 英語の名前と、その上の日本語コメント
    `import { expect, test } from "@playwright/test";

// サインイン画面
test("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
    // describe は英語ならコメント不要
    `import { expect, test } from "@playwright/test";

test.describe("sign-in", () => {
  // サインイン画面
  test("sign-in page", async ({ page }) => {
    await expect(page).toHaveScreenshot();
  });
});`,
    // 別名 import も追う
    `import { expect, test as check } from "@playwright/test";

// サインイン画面
check("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
    // skip などの member は test のまま見る
    `import { expect, test } from "@playwright/test";

// サインイン画面
test.skip("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
    // toHaveScreenshot が無いファイルは VRT ではないので、日本語の名前もそのまま
    `import { expect, test } from "@playwright/test";

test("ログイン後に callbackURL へ移動する", async ({ page }) => {
  await expect(page).toHaveURL("https://app.example/");
});`,
    // 見逃し: custom fixture から import した test は追えない
    `import { expect, test } from "./fixtures";

test("サインイン画面", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
    // 見逃し: 式を含む title は静的に決まらない
    `import { expect, test } from "@playwright/test";

// サインイン画面
test(\`\${name} page\`, async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
    // 日本語以外（韓国語など）は通る
    `import { expect, test } from "@playwright/test";

// サインイン画面
test("로그인 화면", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
    // @playwright/test 以外の test は見ない
    `import { expect, test } from "vitest";

// サインイン画面
test("returns 結果", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
  ],
  invalid: [
    // Bad: 日本語の名前
    {
      code: `import { expect, test } from "@playwright/test";

test("サインイン画面", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "notEnglish" }],
    },
    // Bad: 日本語のコメントが無い
    {
      code: `import { expect, test } from "@playwright/test";

test("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "missingJapanese" }],
    },
    // Bad: describe が日本語
    {
      code: `import { expect, test } from "@playwright/test";

test.describe("サインイン", () => {
  // サインイン画面
  test("sign-in page", async ({ page }) => {
    await expect(page).toHaveScreenshot();
  });
});`,
      errors: [{ messageId: "notEnglish" }],
    },
    // Bad: 日本語のコメントが離れた行にある
    {
      code: `import { expect, test } from "@playwright/test";

// サインイン画面

test("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "missingJapanese" }],
    },
    // 誤検知: 同じファイルのスクリーンショットを撮らないテストにも英語名を要求する
    {
      code: `import { expect, test } from "@playwright/test";

// サインイン画面
test("sign-in page", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});

test("ログイン後に callbackURL へ移動する", async ({ page }) => {
  await expect(page).toHaveURL("https://app.example/");
});`,
      errors: [{ messageId: "notEnglish" }],
    },
    // 2 つの test がそれぞれ指摘される
    {
      code: `import { expect, test } from "@playwright/test";

test("サインイン画面", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});

test("設定画面", async ({ page }) => {
  await expect(page).toHaveScreenshot();
});`,
      errors: [{ messageId: "notEnglish" }, { messageId: "notEnglish" }],
    },
  ],
});
