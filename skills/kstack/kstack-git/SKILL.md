---
name: kstack-git
description: Git の規約。.gitignore など git の設定ファイルを書く・修正する・レビューするときと、commit・PR を作るときに使う。.gitignore を repo root に 1 つだけ置き、サブディレクトリの除外パターンも root の .gitignore に書くこと、commit message（英語 1 行・prefix・gitmoji）と stage する範囲、PR の branch・title・body・draft・assignee を扱う。Terraform・Node.js などの stack や package を足して除外したいファイル（.terraform/、state、build 成果物、node_modules など）が増えたとき、サブディレクトリに .gitignore を作りたくなったとき、ツールが .gitignore を生成したとき、変更を commit するとき、PR を作成するとき、開発フローのフェーズ承認後に commit するとき、レビュー指摘への対応でも発火させる。
---

# kstack-git

[Git](https://git-scm.com/docs/gitignore) の設定ファイルと、commit・PR の作り方の規約。理由を理解した上で適用すること。

## .gitignore は repo root に 1 つだけ置く

サブディレクトリ用の除外も、そのディレクトリに `.gitignore` を作らず root の `.gitignore` に書く。スラッシュを末尾にしか含まないパターン（`.terraform/`、`*.tfstate`）はどの階層にも効く。特定のディレクトリだけに効かせるときは `infra/**/.terraform/` のようにパスを付ける。

```text
# Bad: stack ごとに .gitignore が散らばる
infra/aws/.gitignore          # .terraform/
infra/cloudflare/.gitignore   # .terraform/ と *.tfstate*

# Good: root の .gitignore にまとめる
# .gitignore
.terraform/
*.tfstate
*.tfstate.*
```

なぜ: 除外のルールが 1 ファイルで読め、あるファイルがなぜ追跡されないかを探して回らなくて済む。ディレクトリの改名・削除で .gitignore を取りこぼしたり、同じパターンが複数のファイルで重複・食い違ったりしない。

サブディレクトリの `.gitignore` を root に移したら、`git check-ignore -v <path>` で、除外したいファイルが root のパターンで除外され、lock ファイルなど追跡したいファイルが除外されていないことを確かめる。

## commit の書き方

1. `git status --short` と `git diff --stat` で変更を把握する。`git log --oneline -10` で既存 message の prefix の流儀を確かめ、合わせる
2. 関係する変更だけ stage する。`git add -A` で丸ごと stage せず、無関係な変更は含めない。ファイル全体が今回の変更なら `git add <paths>`、同じファイルに作業前からある差分や別の作業の変更が混ざるなら、今回の hunk だけの patch を `git apply --cached` で index に当てる。作業前から stage されている変更は、勝手に unstage・変更しない
3. commit の前に `git diff --cached --stat` と `git diff --cached` で、stage した内容が今回の変更だけかを確かめる。作業前の stage や同じファイルの混在を分けられなければ、commit せずに止まり、呼び出し元（user や root）に状況を伝える
4. message は英語 1 行だけにし、`<emoji> <prefix>: <summary>` の形にする。emoji は gitmoji で、呼び出し元の指示に emoji 不要（`--no-emoji` 相当）とあれば付けず `<prefix>: <summary>` にする。prefix は feat / fix / refactor / docs / chore / test などから diff に合うものを選ぶ。body（description）は書かない。内容のヒントが指示に無ければ diff から推測する
5. `git commit -m "<message>"` を 1 回だけ実行する。`Co-authored-by` を含めない

```text
Bad: git add -A && git commit -m "update" -m "詳細..." （無関係な変更を含み、prefix が無く、body がある）
Good: git add skills/kstack/kstack-git/SKILL.md && git commit -m "📝 docs: add commit and PR rules to kstack-git"
```

なぜ: 1 行の message は `git log --oneline` で一覧でき、prefix と emoji で変更の種類が見て分かる。`git commit` は stage 済みのものをすべて含み、`git add <path>` はファイル内の作業前の差分も含むので、stage を絞って commit 前に確かめないと、作業前からある差分や別の作業の変更が紛れる。

## PR の作り方

1. `git status --short` で PR に含める未 commit の変更があれば、先に commit する。現在の branch が default branch（`gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`）なら、変更内容を表す kebab-case の branch を `git switch -c <topic>` で作ってから commit する。commit は上の「commit の書き方」に従う（emoji の有無は PR の指示と同じにする）
2. `git log --oneline @{u}..HEAD`（upstream が無ければ `git log --oneline -10`）と `git diff @{u}...HEAD --stat` で内容を把握する。未 push なら先に `git push -u origin HEAD` する
3. title は英語 1 行で `<emoji> <prefix>: <summary>`（emoji 不要の指示があれば `<prefix>: <summary>`）。prefix は commit と同じ選び方にする
4. body は日本語で書く。`pull_request_template.md`・`PULL_REQUEST_TEMPLATE.md`・`.github/pull_request_template.md`・`.github/PULL_REQUEST_TEMPLATE/` 配下のテンプレートがあればその構成に従い、無ければ「概要 / 変更内容 / 確認方法」の 3 節にする。内容のヒントが指示に無ければ diff から推測する
5. `gh pr create --draft --assignee @me --title "<title>" --body "<body>"` で作る。指示に ready（`--ready`・`--no-draft` 相当）とあるときだけ `--draft` を外す
6. 作った agent は read-only の subagent（reviewer）に、PR の URL・`gh pr view <URL> --json title,body,assignees,isDraft` の結果・repo の PR template（あれば）を渡し、次を確かめさせる: (1) assignee に自分（@me）が入っている (2) template があればその節がすべて埋まっている（無ければ「概要 / 変更内容 / 確認方法」） (3) title が `<emoji> <prefix>: <summary>`（emoji 不要の指示時は `<prefix>: <summary>`）の英語 1 行で、body が日本語 (4) draft かどうかが指示どおり
7. ずれがあれば、作った agent が直し、直した後にもう一度 subagent に確かめさせる。title・body・assignee は `gh pr edit <URL>`、draft のずれは `gh pr ready <URL>`（ready にする）か `gh pr ready <URL> --undo`（draft に戻す）で直す。subagent には PR を編集させない

なぜ: draft で作ると、CI と自分の確認が済む前に review を頼まずに済む。default branch で直接 commit しないので、PR の差分が topic branch に閉じる。agent は `gh pr create` の引数や template を取りこぼしやすく、作った本人は自分の書いた本文の漏れに気づきにくいので、別の subagent に確かめさせる。commit・PR の作成は、文脈を持つ作業した agent が行い、subagent は確認だけをする。作成を subagent に任せない。
