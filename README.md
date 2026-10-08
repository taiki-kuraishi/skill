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

```bash
mise install   # bun 1.4.2 に pin
bunx skills ls # プロジェクト SKILL の確認
```
