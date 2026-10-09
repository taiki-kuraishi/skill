---
name: kstack-vite-plus
description: Vite+（vite-plus パッケージ、vp・vpr コマンド）を使うリポジトリで、lint・format・型検査・test・build などのコマンドを書く・修正する・レビューするときの規約。コマンドを直接呼ばず vite.config.ts の run.tasks に定義して vp run 経由で実行し、Vite Task のキャッシュに乗せること、キャッシュから外すコマンド、キャッシュする task に渡す環境変数、run.cache の設定、CI（GitHub Actions）で node_modules/.vite/task-cache を復元することを扱う。package.json の scripts や CI の workflow へのコマンドの追加、CI の高速化、レビュー指摘への対応でも発火させる。
---

# kstack-vite-plus

[Vite+](https://viteplus.dev/guide/) を書くときの規約。理由を理解した上で適用すること。

## コマンドは vp run 経由で実行し、キャッシュに乗せる

lint・format・型検査・test・build などのコマンドは `vite.config.ts` の `run.tasks` に定義し、CI でも手元でも `vp run <task>` で実行する。キャッシュは既定のまま効かせる。

```ts
// vite.config.ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      lint: "oxlint --deny-warnings",
      "fmt-check": "oxfmt --check",
      "type-check": "tsc --noEmit",
      test: "vp test",
      build: "vp build",
      deploy: { command: "wrangler deploy", cache: false },
    },
  },
});
```

```yaml
# Bad: 直接呼ぶと Vite Task のキャッシュを通らない
- run: bun oxlint --deny-warnings
- run: bun tsc --noEmit
- run: bun vp build

# Good
- run: bun vp run lint
- run: bun vp run type-check
- run: bun vp run build
```

なぜ: Vite Task のキャッシュが効くのは `vp run` で実行したコマンドだけで、直接呼ぶと入力が前回と同じでも毎回実行される。`vp run` は、コマンドが読んだファイル・引数・指定した環境変数が前回の成功時と同じなら、出力と書き出したファイルを再生して実行を飛ばす。

キャッシュを外す（`cache: false`）のは、deploy・migration のように実行のたびに外部へ作用するコマンドと、dev server のように終わらないコマンドだけにする。キャッシュが hit するとコマンドは走らずに成功扱いになり、外部への作用が起きないため。

キャッシュする task は、PATH・HOME・CI など一部を除いて環境変数を消した状態で動き、宣言していない環境変数は未設定に見える。コマンドが読む環境変数は、値で結果が変わるなら `cache.env`、変わらないなら `cache.untrackedEnv` に書く（vite-plus 1.0 より前は task 直下の `env`・`untrackedEnv`）。

`package.json` の scripts は既定ではキャッシュされない（`⊘ cache disabled`）。scripts のまま回すなら root の `vite.config.ts` で `run.cache` を `{ scripts: true, tasks: true }` にし、外部へ作用する script は `cache: false` の task に移す。

## CI では task-cache を依存の install の後に復元する

CI の runner は毎回まっさらな状態で始まるので、`vp run` にしただけではキャッシュが毎回空になる。`node_modules/.vite/task-cache` を依存の install の後に `actions/cache/restore` で復元し、検査の後に `actions/cache/save` で保存する。

```yaml
- run: bun ci
- uses: actions/cache/restore@v6
  id: vite-task-cache
  with:
    path: node_modules/.vite/task-cache
    key: vite-task-${{ runner.os }}-${{ runner.arch }}-${{ github.run_id }}-${{ github.run_attempt }}
    restore-keys: vite-task-${{ runner.os }}-${{ runner.arch }}-
- run: bun vp run lint
- uses: actions/cache/save@v6
  if: success()
  with:
    path: node_modules/.vite/task-cache
    key: ${{ steps.vite-task-cache.outputs.cache-primary-key }}
```

なぜ: install は `node_modules` を作り直しうるので、復元はその後に置く。GitHub の cache は同じ key に上書きできないので key は run ごとに変え、入力の変化は Vite Task が task ごとに判定するので lockfile やソースの hash は key に入れない（key で絞ると、hit できた task の分まで復元されなくなる）。

Vite+ はこの復元を実験的な機能としている。入れるときは、restore・save にかかる時間と、`vp run` が出す `cache hit, ... saved` の短縮分を比べる。
