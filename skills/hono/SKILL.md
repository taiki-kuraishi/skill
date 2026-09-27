---
name: hono
description: Hono の RPC を使う TypeScript コードを書く・修正する・レビューするときの規約。型付きクライアント（hono/client の hc、hc<typeof app>、AppType、hcWithType）を API サーバーのパッケージから export し、フロントエンドや他のサービスはそれを import するだけにする構成を扱う。monorepo で API とクライアント（SPA、別 Worker、テスト）が別パッケージになっている場面、RPC クライアントの作成、package.json の exports 設計、レビュー指摘への対応でも発火させる。
---

# hono

[Hono](https://hono.dev/docs/guides/rpc) の RPC を書くときの規約。理由を理解した上で適用すること。

## 型付きクライアントは API のパッケージから export する

`hc<typeof app>(...)` を利用側のパッケージで組み立てない。API のパッケージに client 用の entry を作り、型を計算済みのクライアント生成関数を export する。

```ts
// Bad: 利用側が server の app 型と hono/client を個別に知っている
import type { app } from "@acme/api/server";
import { hc } from "hono/client";

export const apiClient = hc<typeof app>(import.meta.env.VITE_API_URL);
```

```ts
// Good: API パッケージの src/client.ts
import { hc } from "hono/client";

// server は型としてだけ import する。実行時のコードはクライアントの bundle に入らない
import type { app } from "./server";

// コンパイル時に型を一度だけ計算させる
const client = hc<typeof app>("");
export type Client = typeof client;

export const hcWithType = (...args: Parameters<typeof hc>): Client => hc<typeof app>(...args);
```

```jsonc
// API パッケージの package.json
{ "exports": { "./client": "./src/client.ts" } }
```

```ts
// 利用側
import { hcWithType } from "@acme/api/client";

export const apiClient = hcWithType(import.meta.env.VITE_API_URL, {
  init: { credentials: "include" },
});
```

なぜ: クライアントの型は server の route 定義から決まるので、定義と同じパッケージが持てば、利用側は `app` の型や `hc` の型引数を知らずに済み、利用側が増えても `hc<typeof app>` が重複しない。Hono の公式ガイドが推奨するとおり、型を計算済みの関数を使うと tsserver が利用のたびに route の型を展開せず、IDE が軽くなる。

`@acme/api/client` は実行時に import されるので、利用側では devDependencies ではなく dependencies に置く。`app` はメソッドチェーン 1 本で定義しておかないと RPC の型推論が切れる。
