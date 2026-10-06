---
name: tk-stack-agents-md
description: AGENTS.md（CLAUDE.md など coding agent 向けの指示ファイルを含む）を書く・修正する・レビューするときの規約 — コードや設定ファイルを読めば分かる実装の事実（ファイル構成と各ファイルの中身、有効にした機能、resource や設定の値）を書かず、コードに現れないリポジトリの規約（terraform apply・デプロイ・DB migration の実行手順と認証、user の承認が要る操作、レビューと commit の運用）を書く。機能の実装やリファクタリング、レビュー指摘への対応のついでに AGENTS.md を更新する場面や、/init などで AGENTS.md を新しく作る場面でも発火させる。
---

# tk-stack-agents-md

AGENTS.md を書くときの規約。CLAUDE.md など、coding agent が作業の前に読む指示ファイルにも同じく適用する。理由を理解した上で適用すること。

## 実装の事実ではなく、コードに現れないリポジトリの規約を書く

AGENTS.md には、コードのどこにも現れないリポジトリの規約を書く。実環境を変えるコマンド（terraform apply、デプロイ、DB migration）の実行手順と認証、user の承認が要る操作、レビューと commit の運用がこれにあたる。コードや設定ファイルを読めば分かる実装の事実（ファイル構成と各ファイルの中身、有効にした機能、resource や設定の値）は書かない。

```md
<!-- Bad: コードを読めば分かる実装を要約している -->

## アーキテクチャ

- `main.tf` — VPC、subnet、NAT gateway
- `modules/s3/` — S3 bucket。versioning と SSE-S3 を有効にし、`prevent_destroy` で保護している

## 監査ログ

CloudTrail を全 region で有効にしており、ログは `cloudtrail_logs` bucket に 365 日残る
```

```md
<!-- Good: user と決めた、コードを読んでも分からない作業の決まりを書く -->

## terraform apply

1. `aws sso login --profile <profile>` でログインする
2. `terraform plan` の差分を user に見せ、apply してよいか聞く
3. 承認を得てから `terraform apply` を実行する

## commit

user が差分をレビューしてから commit する
```

なぜ: 実装の要約はコードを読まずに済ませる近道として使われ、コードを変えても追従しないので、それを信じた agent は古い前提で作業する。apply の手順や承認の決まりはコードのどこにも書かれていないので、AGENTS.md に無ければ agent は推測で実環境を変えてしまう。

AGENTS.md を書き換えるのは、手順や運用の決まりが増えたり変わったりしたときだけ。機能を実装しただけなら AGENTS.md は変えない。既存の AGENTS.md に実装を要約した節があっても、それに倣って書き足したり、変更に合わせて書き直したりしない。その節が今回の変更で事実と食い違ったら、消すかどうかを user に聞く。

書く規約は、user と決めたことと、作業で実際に使って通った手順に限る。上の Good 例の手順や承認の決まりは書き方の見本なので、そのまま写さない。分からない規約は推測で埋めず、user に聞く。

特定のコードに付く理由（なぜこの値なのか、なぜ定石と違う書き方なのか）は、AGENTS.md ではなくそのコードのコメントに書く（tk-stack-code-comment）。
