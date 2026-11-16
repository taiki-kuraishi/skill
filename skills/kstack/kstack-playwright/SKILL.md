---
name: kstack-playwright
description: Playwright（@playwright/test）でブラウザテストを書く・修正する・レビューするときの規約。VRT（ビジュアルリグレッションテスト、toHaveScreenshot）と E2E テストの置き場所・実行環境（Docker で動かすのは VRT のブラウザだけ）・assert 対象の分け方、VRT のテスト名（英語で書き、日本語はコメントで添える）、VRT は URL と前提データだけで撮り画面を操作しないこと、VRT の認可状態（ログイン・role）は describe 単位の前提データとして固定すること、E2E のテストケース粒度（URL を変える操作・状態の単位、Assert は toHaveURL のみ）、VRT の Assert は toHaveScreenshot のみとし構造を使った locator.waitFor で撮影状態を待つこと、スクリーンショットにも URL にも出ない確認（呼び出し回数・request の中身・localStorage・経過時間）を Playwright に書かないことを扱う。spec ファイルの新規作成、テスト追加先の判断、playwright config の作成、レビュー指摘への対応でも発火させる。
---

# kstack-playwright

Playwright でブラウザテストを書くときの規約。理由を理解した上で適用すること。

## VRT と E2E はディレクトリも config も分ける

VRT はスクリーンショットを assert するテストだけを置く。画面遷移や振る舞いを検証するテストは `test/e2e` のような別ディレクトリに置き、別の playwright config で実行する。

```ts
// Bad: test/vrt/sign-in.spec.ts に、スクリーンショットを撮らない遷移テストが混ざっている
test("ログイン後に callbackURL へ移動する", async ({ page }) => {
  // Arrange
  await page.goto("/sign-in?callbackURL=https://app.example/");

  // Act
  await page.getByRole("button", { name: "ログイン" }).click();

  // Assert
  await expect(page).toHaveURL("https://app.example/");
});

// Good: test/e2e/sign-in.spec.ts に置き、e2e 用の config で実行する
```

なぜ: 「VRT」と名の付く場所にあるテストは、スクリーンショット差分で失敗するものだと読み手は期待する。種類が混ざると、失敗時に見るべきもの（画像差分か遷移先か）と更新手順（`--update-snapshots` の要否）が分からなくなる。

## Docker を使うのは VRT だけ

VRT はフォントやレンダリングの差でスクリーンショットが揺れるため、ブラウザを Docker で動かして描画環境を固定する。runner（`playwright test`）と dev / preview server はホストで動かし、`use.connectOptions` で Docker 内の Browser Server につないでよい。そのときは `exposeNetwork: "<loopback>"` を渡す。Docker 内のブラウザにとって `127.0.0.1` は自分のコンテナを指すので、渡さないとホストの server を開けない。E2E は画素を比べないので Docker を使わず、ブラウザもホストで動かす。

```ts
// Bad: e2e.playwright.config.ts が VRT と同じく Docker 内のブラウザにつないでいる

// Good: Docker のブラウザにつなぐ設定は vrt.playwright.config.ts にだけ書き、e2e.playwright.config.ts はホストのブラウザで動かす
// vrt.playwright.config.ts
export default defineConfig({
  use: {
    baseURL: "http://127.0.0.1:3000",
    connectOptions: { wsEndpoint: "ws://127.0.0.1:51742/", exposeNetwork: "<loopback>" },
  },
});
```

なぜ: 環境固定が必要なのは画像比較のためだけ。E2E まで Docker 前提にすると、起動が遅くなりローカルで気軽に回せなくなるだけで、得るものがない。

## VRT のテスト名は英語で書き、日本語はコメントで添える

VRT の `test` / `describe` の第 1 引数は英語で書き、`test` の上の行に日本語のコメントで内容を書く。

```ts
// Bad
test("サインイン画面", async ({ page }) => {
  // Act
  await page.goto("/sign-in");

  // Assert
  await expect(page).toHaveScreenshot();
});

// Good
// サインイン画面
test("sign-in page", async ({ page }) => {
  // Act
  await page.goto("/sign-in");

  // Assert
  await expect(page).toHaveScreenshot();
});
```

なぜ: `toHaveScreenshot()` はテスト名からスナップショットのファイル名を作るので、日本語の名前はファイル名にも日本語が入る。日本語はコメントに残せば、何を撮るテストかは読める。

## E2E は URL を assert し、テストケースは URL を変える操作・状態の単位にする

E2E は、操作（`click`・`fill` など）や状態（ログイン状態・`localStorage`・API の応答）によって URL がどう変わるかを確かめる。Assert は `toHaveURL` だけにする。文言・要素の有無・件数を `toHaveText`・`toBeVisible`・`toHaveCount` などで expect せず、表示の検証は VRT に任せる。locator を `click`・`fill` などの操作に使うのはよい。テストケースは「この操作をすると（この状態で開くと）、この URL へ移動する（しない）」という、URL を変える操作・状態 1 つにつき 1 ケースで切る。

```ts
// Bad: 描画内容の確認と複数の遷移を 1 ケースに詰め込み、見た目の検証も混ぜている
test("ログイン", async ({ page }) => {
  // Arrange
  await page.goto("/sign-in");

  // Assert
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();

  // Act
  await page.getByRole("button", { name: "ログイン" }).click();

  // Assert
  await expect(page).toHaveURL("/home");

  // Act
  await page.getByRole("link", { name: "ログアウト" }).click();

  // Assert
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

// Good: 状態で URL が変わるケースも、状態 1 つにつき 1 ケース
test("未ログインで /home を開くと /sign-in へ移動する", async ({ page }) => {
  // Arrange
  await page.route("**/api/me", (route) => route.fulfill({ status: 401 }));

  // Act
  await page.goto("/home");

  // Assert
  await expect(page).toHaveURL("/sign-in");
});
```

なぜ: 見た目の検証は VRT の役割で、E2E が担うのは「ユーザーの操作や状態でどこへ行くか」。URL を変える操作・状態の単位で切れば、テスト名がそのまま画面遷移の仕様一覧になり、失敗したときにどの遷移が壊れたか即座に分かる。

## VRT の Assert は toHaveScreenshot だけにする

表示される文言や要素の表示を別の expect で重複検証しない。撮影する状態までの待機は、要素の構造を使った `locator.waitFor()` で行う。

```ts
// Bad: スクリーンショットと同じ表示を文言でも検証している
// Assert
await expect(page.getByText("保存に失敗しました")).toBeVisible();
await expect(page).toHaveScreenshot();

// Good: 構造で撮影状態を待ち、表示は画像で検証する
// Act
await page.locator("main [role='alert']").waitFor();

// Assert
await expect(page).toHaveScreenshot();
```

なぜ: 文言や要素の表示はスクリーンショットにも写る。同じ表示を二重に検証すると、表示を変えるたびに画像と expect の両方を直すことになる。

## VRT は URL を開いた外見だけを撮り、画面を操作しない

VRT の手順は「API の応答などの前提データを用意し、`page.goto` で URL を開き、撮影状態を待って撮る」だけにする。表示を変えたいときは、URL（path・query）か前提データを変える。`click`・`fill`・`hover`・`press` などで画面を操作して辿り着く状態（開いたメニュー、ダイアログ、入力途中のフォーム）は撮らない。

```ts
// Bad: ボタンを押して 2 ページ目を表示してから撮っている
test("media page 2", async ({ page }) => {
  // Arrange
  await page.goto("/media");

  // Act
  await page.getByRole("button", { name: "次のページ" }).click();

  // Assert
  await expect(page).toHaveScreenshot();
});

// Good: 2 ページ目の URL を直接開いて撮る。ボタンで 2 ページ目へ移ることは E2E で確かめる
// 記事一覧の 2 ページ目
test("media page 2", async ({ page }) => {
  // Act
  await page.goto("/media?page=2");
  await page.locator("main table tbody tr").first().waitFor();

  // Assert
  await expect(page).toHaveScreenshot();
});
```

なぜ: 操作を挟むと、スクリーンショットの差分が「見た目が変わった」のか「操作の結果が変わった」のか区別できず、操作の手順が増えるほどテストは長く壊れやすくなる。URL と前提データだけで決まる画面にすれば、1 つの VRT は「この入力ならこの見た目」という 1 対 1 になり、操作による変化は E2E が URL で確かめる。

## VRT の認可状態は前提データとして describe 単位で固定する

ログイン状態・role・権限は、API の応答と同じ前提データとして扱う。同じ URL で見た目が変わる認可状態だけを、`describe` ごとに `beforeEach`（または fixture）で固定して撮る。test の中では認可状態を切り替えず、ログイン・ログアウトの操作やトークンの取得・更新の経過も VRT で扱わない。

```ts
// Bad: 1 つの test の中で認可状態を切り替え、ログアウトの操作もしている
test("settings page", async ({ page }) => {
  // Act
  await page.goto("/settings");

  // Assert
  await expect(page).toHaveScreenshot("staff.png");

  // Arrange
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "member" } }));

  // Act
  await page.reload();

  // Assert
  await expect(page).toHaveScreenshot("member.png");

  // Act
  await page.getByRole("button", { name: "ログアウト" }).click();
});

// Good: 認可状態ごとに describe を分け、前提データとして固定する
test.describe("member", () => {
  test.beforeEach(async ({ page }) => {
    // Arrange
    await page.route("**/api/me", (route) => route.fulfill({ json: { role: "member" } }));
  });

  // member が開いた設定画面
  test("settings page", async ({ page }) => {
    // Act
    await page.goto("/settings");
    await page.locator("main form").waitFor();

    // Assert
    await expect(page).toHaveScreenshot();
  });
});
```

なぜ: 認可状態で変わるのは「同じ URL の見た目」なので、前提データの 1 つとして固定すれば VRT は外見の比較に集中できる。test の中で切り替えると、状態の遷移とその経過の検証が混ざり、テストのコードが認証の仕組みに引きずられて複雑になる。認可状態で URL が変わるか（未ログインならサインイン画面へ移るなど）は E2E で確かめる。

## Playwright で確かめるのは VRT の見た目と E2E の URL だけにする

API の呼び出し回数・request の中身・`localStorage` の値・class や data 属性・表示が続く時間のように、スクリーンショットにも URL にも現れないものは Playwright のテストにしない。

```ts
// Bad: 画面にも URL にも出ない、トークンの再取得回数を数えている
test("トークンを 1 回だけ再取得する", async ({ page }) => {
  // Arrange
  let count = 0;
  await page.route("**/auth/token", (route) => {
    count += 1;
    return route.fulfill({ json: { token: "t" } });
  });

  // Act
  await page.goto("/");

  // Assert
  expect(count).toBe(1);
});

// Good: Playwright のテストにしない。その結果として表示が変わるなら VRT、URL が変わるなら E2E で確かめる
```

なぜ: VRT と E2E の線引きは「見た目か URL か」で、どちらにも当てはまらない確認を足すと、その線引きが崩れて同じ混在が繰り返される。画面にも URL にも出ない値は利用者が観測できないので、ブラウザを起動してまで確かめる対象ではない。
