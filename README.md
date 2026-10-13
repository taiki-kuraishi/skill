# skill

vercel-labs/skills 互換の SKILL 配布リポジトリ。

## 使い方

```bash
bunx skills add taiki-kuraishi/skill
```

SKILL は `skills/kstack/kstack-<name>/SKILL.md` の構成で追加する。`name` にも同じ `kstack-` prefix を付ける（`skills/kstack/` 内で `bunx skills init kstack-<name>` を実行、または SKILL.md を直接作成）。フロントマターの必須項目は `name` と `description`。

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

## user review

実装後の user review は [kstack-review-request](skills/kstack/kstack-review-request/SKILL.md) に共通化する。root-driven-development・interface-first-development・handoff・skill-from-review から呼び出し、レビュー用ツール・操作・承認の判定方法はこの SKILL に集約する。`skill-from-review` は配布しない内部 SKILL なので、配布する `kstack-review-request` の呼び出し元の一覧には載せない。

root と子で進める場合、起動方式にかかわらず user への依頼とレビュー手順の管理は root に集約する。子の質問・進捗・完了報告・指摘への対応結果は intercom で root に届く。[手動引き継ぎ](skills/kstack/kstack-interface-first-development/references/manual-handoff.md)でも root は監督を続ける。user の子への操作は最初の起動と prompt の貼り付けだけで、以後の pane の巡回や報告の転送は不要。

SSH 環境の公開 URL・起動設定は、共通 SKILL の「[起動](skills/kstack/kstack-review-request/SKILL.md#起動)」を参照する。ホスト名は呼び出し元のフローに埋め込まない。

承認は共通 SKILL の手順で受け取る。stage・commit・push の権限は各フローで合意した範囲に従い、レビュー承認と混同しない。

## 開発環境

[mise](https://mise.jdx.dev/) を用意し、repo root で実行する。

```bash
mise run install
bunx skills ls
```

ツールのバージョンは `mise.toml` と `mise.lock` で管理する。手動でpinを変更した場合は `mise lock` でlockfileも更新する。TypeScriptの依存（Vite+・TypeScript）は `package.json` と `bun.lock` で管理する。

npmのCLIはBunで導入し、開発機のglobal mise設定とCIの既定値によるinstaller差を排除する。

### 整形・検査

```bash
mise run format
mise run lint
mise run build
mise run test
mise run check
```

- `format`: dprintでMarkdown・TOML・JSON・YAMLを、oxfmt（`vp run fmt`）でTypeScriptを整形する。
- `lint`: markdownlintでMarkdownを、oxlint（`vp run lint`）でTypeScriptを検査する。TypeScriptには `@taiki-kuraishi/oxlint-config` の設定を当てるため、先にそのpackageをbuildする。
- `build`: `packages/*` を `vp pack` でbuildする（`vp run -r build`）。
- `test`: `packages/*` のテストを `vp test` で実行する（`vp run -r test`）。
- `check`: 整形、Markdown lint、TypeScriptのlint・整形・型検査・build・テスト、Lefthook設定、Renovate設定を変更せずに検査する。

TypeScriptのlint・整形・型検査・build・テストは、root と各packageの `vite.config.ts` の `run.tasks` に定義し、`vp run` 経由で実行する。

MarkdownはREADME、`skills/`、`.omp/skills/`、`.pi/skills/`を含めて検査する。SKILLの説明文と表は文意の区切りを優先するため、dprintの`textWrap`を`maintain`にし、markdownlintの行長制限（MD013）を無効にしている。

pre-commitではstaged fileの整形とMarkdown lintを検査し、TypeScriptが変わった場合はlint・整形・型検査も行う。関連する設定やツールpinが変わった場合はMarkdown全体と設定ファイルも検査する。hookは自動修正・自動stageを行わない。

GitHub ActionsはPRとmainへのpushで`ci.yml`を起動する。`changes`がpathを判定し、dprint・Markdown lint・Lefthook検証・Renovate検証・Vite+（TypeScriptのlint・整形・型検査・build・テスト）をそれぞれ独立したjobとして実行する。対象外のjobは省き、各jobに必要なツールだけ導入する。reusable workflowは使わない。依存のinstall（`setup-bun`）とVite+のtask-cacheの復元・保存（`vite-task-cache`）は`.github/actions/`のcomposite actionに置き、`jdx/mise-action`はjobのstepsでその前に呼ぶ。

`check`は検査jobの結果を集約して常時報告する。`changes`がsuccess以外、またはいずれかの検査がfailure/cancelledなら失敗し、対象外の検査によるskipは許可する。workflow自体を`on.paths`で省かず、required checkがPendingのまま残ることを防ぐ。

`publish.yml`はmainへのpushで`packages/*/package.json`が変わったときに起動し、各packageをbuild・テストしてGitHub Packagesへ`bun publish`する。publish済みのversionは`--tolerate-republish`で飛ばすので、publishしたいpackageは`version`を上げてmergeする。`bun publish`は`publishConfig.registry`を読まないため、registryとtokenは環境変数で渡す。

## Renovate

miseのツール、npmの依存（`package.json`・`bun.lock`）、GitHub Actions、dprintプラグインを更新対象にする。

| 更新                      | PR         | マージ                           |
| ------------------------- | ---------- | -------------------------------- |
| major                     | 作成する   | Approve後に手動マージ            |
| minor                     | 作成する   | 全CI成功後にRenovateが自動マージ |
| 通常patch                 | 作成しない | —                                |
| 検知したセキュリティpatch | 作成する   | レビュー後に手動マージ           |

レビューが必要なPRは`taiki-kuraishi`へレビューを依頼する。自動マージ対象のPRには通常レビューを依頼せず、CI失敗時にはRenovateの標準動作で依頼する。

セキュリティ修正がmajor/minorで提供される場合も、その更新種別のマージ条件に従う。

セキュリティ修正の検知はGitHubの脆弱性アラートとOSVの対応範囲に限られる。OSVはnpm依存を検査できるが、GitHub Releases由来のツールを網羅しない。GitHub Actionsのdigest更新など、major/minor/patch以外の更新は既定の手動レビュー対象になる。

Renovate CLIの導入はbotの稼働を意味しない。[Renovate App](https://github.com/apps/renovate)にこのrepoへのアクセスを許可し、GitHubのDependency graphとDependabot alertsを有効にする。AppのDependabot alertsへのread権限も確認する。

miseの更新PRでは、`mise.lock`も更新されていることを確認する。ロック更新にはRenovateの実行環境でmiseを実行できることが必要で、実行できない場合はCIの`--locked`検査が失敗し、自動マージされない。

### GitHub側のルール

`renovate.json`だけではPRレビューのApproveを強制できない。CI設定をmainへ反映し、PRで実際のcheck名を確認してから、default branchを対象とした次の2つのrulesetを有効にする。既存の削除・force-push保護は維持する。

1. **承認ルール**: PRの承認を1件以上必須にする。Renovate App（Integration ID `2740`）だけを「For pull requests only」のbypass対象にする。
2. **CIルール**: `check`をrequired status checkにし、bypass対象を設けない。

Renovateの承認bypassは更新種別を区別しない。majorを自動マージしない制御はRenovate設定が担い、手動マージ時のApproveは承認ルールが要求する。CIが未報告の状態でrequired checksを有効にするとPRがマージできなくなるため、設定の順序を守る。

## License

[Apache License 2.0](LICENSE)

著作権の表示は [NOTICE](NOTICE) にあり、publish する各 package にも同梱する。
