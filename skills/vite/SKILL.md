---
name: vite
description: Vite でビルドするフロントエンドのコードを書く・修正する・レビューするときの規約。環境変数（import.meta.env、VITE_ prefix、.env ファイル、ImportMetaEnv の型宣言）の読み方を扱う。API の URL などビルド時の値をクライアントに渡すコード、env や config を包む定数モジュールの作成、vite-env.d.ts の編集、レビュー指摘への対応でも発火させる。
---

# vite

[Vite](https://vite.dev/guide/env-and-mode) を書くときの規約。理由を理解した上で適用すること。

## 環境変数は使う場所で import.meta.env から読む

`import.meta.env` の値を定数として再 export するモジュールを作らない。値が要る場所で `import.meta.env.VITE_*` を直接書く。

```ts
// Bad: env.ts / config.ts が値を包み直し、利用側はそこを経由する
export const apiUrl = import.meta.env.VITE_API_URL;
export const authUrl = import.meta.env.VITE_AUTH_URL;

// Good: 使う場所で読む
export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_AUTH_URL}/api/auth`,
});
```

```ts
// 型は vite-env.d.ts の ImportMetaEnv に宣言する
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_URL: string;
}
```

なぜ: 再 export の層は、値がビルド時の env から来るという事実を隠し、読む人に定義を 2 段たどらせる。Vite は `import.meta.env.X` をビルド時に静的に置き換えるので、都度書いても実行時のコストは無い。型は `ImportMetaEnv` に宣言すれば、どこで書いても補完と型検査が効く。
