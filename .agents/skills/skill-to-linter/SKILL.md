---
name: skill-to-linter
description: "この SKILL 配布リポジトリで kstack-* SKILL を作成・追記した後、その規約を oxlint / oxfmt のルール・設定で表せるか検証し、表せるものを packages/oxlint-config・packages/oxfmt-config に実装する手順。skill-from-review の作成・追記の後に呼ぶほか、既存 SKILL を linter 化・lint ルール化したいと言われたとき、自作 oxlint ルール（JS plugin）を足すときに使用すること。"
metadata:
  internal: true
---

# skill-to-linter

kstack-* SKILL の規約を、配布する lint 設定に写す手順。設定は SKILL ごとに `kstack-` を除いた名前（`kstack-typescript` → `typescript`）で export し、利用側は `extends` に渡す。

## 手順

1. **規約ごとに判定する** — subagent に、SKILL の各規約の Bad / Good を型が通る形で `/tmp` に置かせ、次のどれで表せるかを実際に lint・整形して確かめさせる。結論は root が決める。完了条件: すべての規約に、試した結果（Bad / Good での出力）付きの判定がある
   - oxlint の既存ルールの設定（`oxlint --rules --format=json` で全ルールを探す）
   - 自作ルール（JS plugin。AST だけで判定できるもの）
   - oxfmt の設定
   - 表せない
2. **既存ルールの設定を足す** — `packages/oxlint-config/src/index.ts` の該当設定（無ければ新設）の `rules` に書き、`satisfies OxlintConfig` で検査する。oxfmt で表せるなら `packages/oxfmt-config/src/index.ts` に同名で export する。完了条件: 判定が既存ルール・oxfmt の規約がすべて設定に入っている
3. **自作ルールを書く** — `packages/oxlint-config/src/rules/<rule>.ts` に `@oxlint/plugins` の `defineRule` と `createOnce` で書き、`src/plugin.ts`（plugin 名 `kstack`）に登録し、設定の `rules` で `kstack/<rule>` を有効にする。完了条件: 判定が自作ルールの規約がすべて登録・有効化されている
4. **テストを書く** — `packages/oxlint-config/test/<rule>.test.ts` に `vite-plus/lint/plugins-dev` の `RuleTester` で、SKILL の Bad / Good と、判定で見つかった誤検知・例外の形を valid / invalid に入れる。完了条件: 自作ルールごとにテストがあり、判定で見つかった形がすべてケースに入っている
5. **対応表を更新する** — 各 package の README の「SKILL と設定の対応」に、規約ごとのルール、または表せない理由を書く。検出しない形・disable コメントで扱う例外もここに書く。完了条件: SKILL のすべての規約が表に載っている
6. **検証する** — subagent に `mise run check` を回させ、さらに `bun pm pack` した tarball を `/tmp` の利用側 project に入れ、`extends` した設定で Bad に指摘が出て Good に出ないことを確かめさせる。repo 自身のコードに出た指摘は直すか、直さない理由を示す。完了条件: check が通り、利用側で Bad / Good の結果が判定どおりである
7. **version を上げる** — 設定・ルールを変えた package の `package.json` の version を上げる（ルールの追加は minor、誤検知の修正と、LICENSE・NOTICE など配布物の中身だけの変更は patch）。main に merge されると `publish.yml` が GitHub Packages へ publish する。完了条件: 変えた package の version が上がっている

```text
Bad: 既存ルールの名前が近いので、試さずに当てはまると判定する
Good: Bad / Good を lint して、見逃し（例: return しない else）と誤検知（例: コールバック）を確かめてから判定する
```

なぜ: 名前が近いルールでも、検出する範囲が規約と違うことが多い。試さずに入れると、守れていない規約を lint で守れていると思い込む。

## 判断の目安

- 表せない規約は無理にルール化しない。「小さい」「意味がある」のような判断が要る規約は、閾値を決めると誤検知が増える。表せない理由を対応表に書き、レビューで確かめる
- 型情報が要る判定はできない（oxlint の JS plugin は型情報を使えない）。構文で近似するなら、外れる形を対応表に書く
- 既存ルールと自作ルールで同じ箇所が二重に指摘されるなら、範囲の狭い方を外す
- 規約と逆向きのルール（例: `unicorn/prefer-ternary`、`explicit-function-return-type`）は、`typescript` が category 単位で有効にしているので、`rules` で `"off"` にし、README の off の表に理由を書く

## 落とし穴

- `plugins` は設定ごとに扱われる。`extends` を使わない設定に書くと既定の plugin（`unicorn`・`typescript`・`oxc`）が上書きされ、そのルールが黙って無効になる。`plugins` を持たない設定は既定の 3 つを補うので、`extends` で渡す設定に書いても既定は消えない。既定のもので足りるなら書かない
- `no-restricted-syntax` と `padding-line-between-statements` は oxlint に無い。AST の形で決まる規約は自作ルールにする
- `extends` で配る設定の `jsPlugins` は package 名（`@taiki-kuraishi/oxlint-config/plugin`）で書く。相対パスはエラーになる
- repo 自身の lint で plugin を解決するには、root の devDependencies に `workspace:*` のリンクと、lint task から build への `dependsOn` が要る
- `vp lint --print-config` は `jsPlugins` 由来のルールを表示しない。有効かどうかは実際に lint して確かめる
- `RuleTester` の column は 0 始まり（`eslintCompat` を付けない場合）
