---
name: cloudflare-vite-plugin
description: Vite でビルドして Cloudflare Workers にデプロイするアプリを書く・修正する・レビューするときの規約。Worker script が無い assets-only の SPA や静的サイトも含め、@cloudflare/vite-plugin の cloudflare() でビルドし、wrangler の設定を vite.config.ts で自前で読まない構成を扱う。vite.config.ts の plugins・define・build.outDir の編集、wrangler.jsonc の assets（directory、not_found_handling）設定、unstable_readConfig の利用、CLOUDFLARE_ENV によるステージ切り替え、レビュー指摘への対応でも発火させる。
---

# cloudflare-vite-plugin

[Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) を使うときの規約。理由を理解した上で適用すること。クライアントコードでの環境変数の読み方は vite の SKILL を参照。

## Cloudflare Workers へは @cloudflare/vite-plugin でビルドする

Workers にデプロイするアプリは、Worker script が無い assets-only の SPA であっても `@cloudflare/vite-plugin` を使う。wrangler の設定を vite.config.ts で読んだり、出力先を wrangler.jsonc と二重に書いたりしない。

```ts
// Bad: wrangler の設定を自前で読み、define で埋め込み、outDir を assets.directory と合わせている
const { vars } = unstable_readConfig({ config: "wrangler.jsonc" });
export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.API_URL": JSON.stringify(vars.API_URL) },
  build: { outDir: "dist" },
});

// Good: plugin に任せる。クライアントに渡す値は .env の VITE_* に置く
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({ plugins: [react(), cloudflare()] });
```

```jsonc
// wrangler.jsonc: assets.directory は書かない。SPA は not_found_handling だけ指定する
{ "assets": { "not_found_handling": "single-page-application" } }
```

なぜ: plugin は `vite build` のときに client の出力先を `assets.directory` に埋めた wrangler.json を生成するので、出力先の二重管理が無くなる。`vite dev` / `vite preview` も workerd 上で動き、SPA fallback などの assets の挙動を本番と同じ形で確かめられる。`unstable_` の wrangler API に依存するコードも要らない。ステージごとの値は `.env.[mode]` か `CLOUDFLARE_ENV` で切り替える。
