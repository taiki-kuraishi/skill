# skill

vercel-labs/skills 互換の SKILL 配布リポジトリ。

## 使い方

```bash
bunx skills add taiki-kuraishi/skill
```

SKILL は `skills/tk-stack-<name>/SKILL.md` の構成で追加する。`name` にも同じ `tk-stack-` prefix を付ける（`skills/` 内で `bunx skills init tk-stack-<name>` を実行、または SKILL.md を直接作成）。フロントマターの必須項目は `name` と `description`。

## user review

実装後の user review は [tk-stack-review-request](skills/tk-stack-review-request/SKILL.md) に共通化する。root-driven-development・interface-first-development・handoff から呼び出し、レビュー用ツール・操作・承認の判定方法はこの SKILL に集約する。

root と子で進める場合、起動方式にかかわらず user への依頼とレビュー手順の管理は root に集約する。子の質問・進捗・完了報告・指摘への対応結果は intercom で root に届く。[手動引き継ぎ](skills/tk-stack-interface-first-development/references/manual-handoff.md)でも root は監督を続ける。user の子への操作は最初の起動と prompt の貼り付けだけで、以後の pane の巡回や報告の転送は不要。

SSH 環境の公開 URL・起動設定は、共通 SKILL の「[起動](skills/tk-stack-review-request/SKILL.md#起動)」を参照する。ホスト名は呼び出し元のフローに埋め込まない。

承認は共通 SKILL の手順で受け取る。stage・commit・push の権限は各フローで合意した範囲に従い、レビュー承認と混同しない。

## 開発環境

[mise](https://mise.jdx.dev/) を用意し、repo root で実行する。

```bash
mise run install
bunx skills ls
```

ツールのバージョンは `mise.toml` と `mise.lock` で管理する。手動でpinを変更した場合は `mise lock` でlockfileも更新する。

npmのCLIはBunで導入し、開発機のglobal mise設定とCIの既定値によるinstaller差を排除する。

### 整形・検査

```bash
mise run format
mise run lint
mise run check
```

- `format`: dprintでMarkdown・TOML・JSON・YAMLを整形する。
- `lint`: markdownlintでMarkdownを検査する。
- `check`: 整形、Markdown lint、Lefthook設定、Renovate設定を変更せずに検査する。

MarkdownはREADME、`skills/`、`.omp/skills/`、`.pi/skills/`を含めて検査する。SKILLの説明文と表は文意の区切りを優先するため、dprintの`textWrap`を`maintain`にし、markdownlintの行長制限（MD013）を無効にしている。

pre-commitではstaged fileの整形とMarkdown lintを検査する。関連する設定やツールpinが変わった場合はMarkdown全体と設定ファイルも検査する。hookは自動修正・自動stageを行わない。

GitHub ActionsはPRとmainへのpushで`ci.yml`を起動する。`changes`がpathを判定し、dprint・Markdown lint・Lefthook検証・Renovate検証をそれぞれ独立したjobとして実行する。対象外のjobは省き、各jobに必要なツールだけ導入する。reusable workflowやcomposite actionによるローカル呼び出しは使わない。

`check`は検査jobの結果を集約して常時報告する。`changes`がsuccess以外、またはいずれかの検査がfailure/cancelledなら失敗し、対象外の検査によるskipは許可する。workflow自体を`on.paths`で省かず、required checkがPendingのまま残ることを防ぐ。

## Renovate

miseのツール、GitHub Actions、dprintプラグインを更新対象にする。

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
