# skill

vercel-labs/skills 互換の SKILL 配布リポジトリ。

## 使い方

```bash
bunx skills add taiki-kuraishi/skill
```

SKILL は `skills/<name>/SKILL.md` の構成で追加する（`skills/` 内で `bunx skills init <name>` を実行、または SKILL.md を直接作成）。フロントマターの必須項目は `name` と `description`。

## 開発環境

```bash
mise install   # bun 1.4.2 に pin
bunx skills ls # プロジェクト SKILL の確認
```
