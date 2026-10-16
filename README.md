# skill

vercel-labs/skills 互換の SKILL 配布リポジトリ。

## インストール

```bash
bunx skills add taiki-kuraishi/skill
```

## lint 設定の利用

SKILL の規約のうち lint で表せるものは、GitHub Packages の `@taiki-kuraishi/oxlint-config` として配布する。SKILL ごとに `kstack-` を除いた名前の設定（`kstack-typescript` → `typescript`）を export する。対応する規約と表せない規約は [packages/oxlint-config/README.md](packages/oxlint-config/README.md) の対応表にある。

利用側の repo root の `.npmrc` に registry と token を書き、install する。

```ini
@taiki-kuraishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
bun add -D @taiki-kuraishi/oxlint-config
```

package は public だが、GitHub Packages は install にも token を求める。`NODE_AUTH_TOKEN` には、手元では `read:packages` を持つ classic の PAT を、GitHub Actions では `packages: read` を付けた `GITHUB_TOKEN` を渡す。

Vite+ を使う repo では `vite.config.ts` の `lint` に、oxlint を単体で使う repo では `oxlint.config.ts` に、設定を `extends` で渡す。

```ts
// vite.config.ts
import { typescript } from "@taiki-kuraishi/oxlint-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    extends: [typescript],
  },
});
```

```ts
// oxlint.config.ts
import { typescript } from "@taiki-kuraishi/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [typescript],
});
```

`extends` を使わない設定に `plugins` を書くと、既定の plugin（`unicorn`・`typescript`・`oxc`）が上書きされ、そのルールが無効になる。その場合は既定の 3 つも並べる。上の例のように `extends` で設定を渡していれば、`plugins` を書いても既定の 3 つは残る（`plugins` を持たない設定が既定の 3 つを補うため。oxlint 1.87.0・Vite+ 1.1.0 で確認）。

`@taiki-kuraishi/oxfmt-config` も同じ registry で配布するが、oxfmt で表せる規約がまだ無いため、export する設定は無い。

## License

[Apache License 2.0](LICENSE)

著作権の表示は [NOTICE](NOTICE) にあり、publish する各 package にも同梱する。
