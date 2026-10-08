---
name: skill-from-review
description: "コードレビューの指摘（tuicr 形式: file:line + コメント）をライブラリ単位の SKILL に変換して、skills 配布リポジトリに蓄積するための運用手順。レビュー指摘のリストを添付されたとき、コーディング規約を SKILL 化してほしいと言われたときに必ず使用すること。このリポジトリでの SKILL 作成・追記・分類の依頼全般で、skill-creator より先に発火させる（作成・追記はここから skill-creator を呼び出す）。"
metadata:
  internal: true
---

# skill-from-review

コードレビューの指摘を、ライブラリ単位の SKILL として SKILL 配布リポジトリに蓄積する手順。SKILL.md を書く作業は skill-creator に任せ、この SKILL はその前後（指摘の分類、リポジトリ規約の受け渡し、一覧への登録、検証）を受け持つ。

このリポジトリは vercel-labs/skills 互換の SKILL 配布リポジトリ（`skills/tk-stack-<name>/SKILL.md` 規約）。レビュー指摘は「特定ライブラリ・言語を書くときに今後も効く規約」に変換して蓄える。1 回限りの修正指示は SKILL 化しない。

## 手順

1. **指摘を分類する** — 指摘を 1 件ずつ読み、「どのライブラリ / 言語 / フレームワークを書くときに効く規約か」で分類する。同じ対象に属する指摘は 1 つの SKILL にまとめる。例: 「関数の返型を書かない」「早期 return」→ `tk-stack-typescript`、「Result.gen の書き方」→ `tk-stack-better-result`
2. **追記 or 新規作成を決める** — `skills/` 配下に `tk-stack-<対象ライブラリ名>` の SKILL があれば追記、なければ新規作成にする
3. **skill-creator で書く** — skill-creator を読み込み、対象 SKILL ごとにその手順を回して SKILL.md を書く。新規作成は「Creating a skill」、追記は「Improving the skill」（baseline は追記前の snapshot）として進め、各段階に下の「skill-creator への渡し方」を適用する。完了条件: SKILL.md が書き上がり、テストを回したなら user が結果に満足している。skill-creator の手順を終えたら手順 4 に戻る
4. **一覧に登録する** — 新規作成したら `skills/tk-stack-skill-review/SKILL.md` の SKILL 一覧と `description` に名前を追記する。一覧に無い SKILL はレビューで読まれない
5. **検証する** — ユーザーの agent 環境を変えないよう `/tmp` 下の作業ディレクトリで `bunx skills add <repo-path> --agent claude-code -y` を実行し、対象 SKILL が発見・インストールされることを確認する。リポジトリ本体は stage / commit しない（user の指示があるまで）
6. **user review に回す** — 変更ファイルと検証証拠を示してレビューを依頼する

## skill-creator への渡し方

skill-creator の既定と食い違うところは、ここと「リポジトリ規約」を優先する。

- **Capture Intent / Interview** — 何をする SKILL か・いつ発火するかは、手順 1 で分類した指摘から埋める。user に聞くのは指摘から読み取れない点だけにする
- **Write the SKILL.md** — 「リポジトリ規約」に従う
- **Test Cases** — テストを回すかは、新規作成・追記とも user に確認する。回すなら、指摘されたコードを書いた場面を再現する依頼をテストプロンプトにする。baseline で指摘どおりの Bad が出るプロンプトでないと、規約が挙動を変えたか判定できない
- **workspace** — skill ディレクトリの隣ではなく `/tmp/<skill-name>-workspace/` に置き、`evals/evals.json` もそこに置く。skill ディレクトリ内のファイルは `bunx skills add` で SKILL.md と一緒に配布先へコピーされ、`skills/` 配下の作業ファイルはリポジトリの変更に紛れ込む

## リポジトリ規約

- ディレクトリ: `skills/tk-stack-<library-name>/SKILL.md`（`tk-stack-` prefix を付け、`<library-name>` は lowercase、hyphen 区切り）
- フロントマターは `name`（ディレクトリ名と一致）と `description` のみ必須
- `description` の発火条件には、ライブラリ名、扱う概念、依頼種別（作成 / 修正 / レビュー）を入れる。追記で扱う概念が増えたら `description` にも足す
- `description` に ASCII のコロン（`file:line` など）を含むときは値全体をシングルクォートで括る。裸のコロンは YAML パースエラーになり、SKILL が黙ってスキップされる
- 各規約に Bad / Good のコード例と「なぜ」を 1〜2 文添える
- 対象リポジトリ固有の文脈（ファイル名や専用のドメイン語）を書かない。規約は他のプロジェクトでも使える形に一般化する
- 追記は既存 SKILL のスタイルと構成を踏襲する
- SKILL.md は短く保つ（目安 100 行以下）

## 判断の目安

- 指摘が「このコードのこの箇所だけ」の修正 → SKILL 化しない。ただし一般化できる指摘（「返型は書かない」など）はその限りでない
- 対象がどのライブラリに属するか曖昧なら、ユーザーに 1 回質問する
- 既存 SKILL の規約と矛盾する指摘が来たら、追記ではなく既存規約の修正案として提示する
