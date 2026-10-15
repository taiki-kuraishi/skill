---
name: kstack-git
description: .gitignore など git の設定ファイルを書く・修正する・レビューするときの規約。.gitignore を repo root に 1 つだけ置き、サブディレクトリの除外パターンも root の .gitignore に書くことを扱う。Terraform・Node.js などの stack や package を足して除外したいファイル（.terraform/、state、build 成果物、node_modules など）が増えたとき、サブディレクトリに .gitignore を作りたくなったとき、ツールが .gitignore を生成したとき、レビュー指摘への対応でも発火させる。
---

# kstack-git

[Git](https://git-scm.com/docs/gitignore) の設定ファイルを書くときの規約。理由を理解した上で適用すること。

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
