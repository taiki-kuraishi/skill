---
name: tk-stack-vite
description: Vite でビルドするフロントエンドのコードを書く・修正する・レビューするときの規約。環境変数（import.meta.env、VITE_ prefix、.env ファイル、ImportMetaEnv の型宣言）の読み方と、パスエイリアス（@/ などの import、resolve.alias、resolve.tsconfigPaths、tsconfig.json の paths）の設定を扱う。API の URL などビルド時の値をクライアントに渡すコード、env や config を包む定数モジュールの作成、vite-env.d.ts・vite.config.ts の編集、レビュー指摘への対応でも発火させる。
---

# tk-stack-vite

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

## パスエイリアスは tsconfig.json の paths だけに書く

`@/` などのエイリアスは tsconfig.json の `paths` に書き、Vite には `resolve.tsconfigPaths: true` で読ませる。同じ対応を `resolve.alias` に書き写さない。

```ts
// Bad: tsconfig.json の paths と同じ対応を、vite.config.ts にも手で書いている
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});

// Good: tsconfig.json の paths を Vite が読む（Vite 8 以降の組み込みオプションで、プラグインは要らない）
export default defineConfig({
  resolve: { tsconfigPaths: true },
});
```

なぜ: 型検査とエディタのために、`paths` はどのみち tsconfig.json に要る。`resolve.alias` にも書くと対応表が 2 つになり、片方だけ直すと型検査は通るのにビルドで解決できない、といったずれが起きる。Vite のドキュメントは性能上のコストを注記しているが、対応表を 1 か所に保つ方を取る。
