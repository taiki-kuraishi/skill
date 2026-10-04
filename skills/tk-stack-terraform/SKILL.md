---
name: tk-stack-terraform
description: Terraform（.tf ファイル、HCL）を書く・修正する・レビューするときの規約。リテラル値に名前を付けるときは locals ではなく default 付きの variable にすること、resource を S3 なら modules/s3 のようにサービス名の module にまとめ、module 内を bucket などの主リソースごとのファイルに分けること、同じ種類の resource が増えても衝突しない名前を付けることを扱う。AWS などのインフラの追加、module 化やファイル分割のリファクタリング、レビュー指摘への対応でも発火させる。
---

# tk-stack-terraform

[Terraform](https://developer.hashicorp.com/terraform/language) を書くときの規約。理由を理解した上で適用すること。

## リテラル値に名前を付けるときは locals ではなく default 付きの variable にする

account ID やドメイン名など、リテラルの値に名前を付けて参照するときは、`locals` ではなく `variable` を宣言して値を `default` に置く。

```hcl
# Bad: 設定の入力が locals に埋もれる
locals {
  log_account_id = "123456789012"
}

# Good: 入力として宣言し、値は default に置く
variable "log_account_id" {
  type        = string
  description = "ログを集約する AWS account の ID"
  default     = "123456789012"
}
```

なぜ: variable にすると値が設定の入力として型と説明付きで宣言され、コードを書き換えずに `-var`・tfvars・`TF_VAR_log_account_id` で差し替えられる。locals は他の値から組み立てる式に名前を付ける場所なので、`"arn:aws:iam::${var.log_account_id}:root"` のような式は locals に置いてよい。

root の variable を module の中で使うときは引数で渡し、module 側の variable は default なしで受ける。同じリテラルを root と module の 2 か所に書くと、片方だけ直したときに食い違う。

## module はサービス単位で切り、サービス名を付ける

resource は provider のサービスごとの module（S3 なら `modules/s3`、IAM なら `modules/iam`）に置き、root から呼ぶ。

```text
# Bad: 用途の名前のファイルに、複数サービスの resource が混ざる
logging.tf    # aws_s3_bucket、aws_iam_role、aws_cloudwatch_log_group

# Good: サービス名の module に分け、root の main.tf から module "s3" { source = "./modules/s3" } のように呼ぶ
modules/
├── s3/
├── iam/
└── cloudwatch/
```

なぜ: resource type から置き場所が一つに決まるので、探すときも足すときも迷わない。用途で切ると境界の引き方が人によって変わり、複数の用途に使う resource の置き場所も決まらない。

## module の中は主リソースごとにファイルを分ける

bucket や role などの主リソース 1 つにつき 1 ファイルにし、その主リソースに付く resource（versioning、暗号化、public access block、policy など）を同じファイルに置く。ファイル名は主リソースの label にする（`aws_s3_bucket.cloudtrail_logs` なら `cloudtrail_logs.tf`）。

```text
# Bad: すべての bucket と付属の resource が 1 ファイルに並ぶ
modules/s3/main.tf

# Good: bucket ごとに 1 ファイル
modules/s3/
├── cloudtrail_logs.tf    # aws_s3_bucket.cloudtrail_logs と、その versioning・暗号化・public access block
├── alb_access_logs.tf
└── variables.tf
```

なぜ: bucket 1 つの設定は bucket 本体と複数の付属 resource に分かれる。bucket ごとのファイルなら 1 ファイル読めばその bucket の全体が分かり、追加・削除もファイル単位で済む。

## resource 名は種類ではなく個体を指す

resource の名前（label）は、同じ種類の resource が増えても区別できるように付ける。

```hcl
# Bad: 「ログ用」という種類の名前。2 つ目のログ bucket を足すと区別できない
resource "aws_s3_bucket" "logs" {
  bucket = "acme-logs"
}

# Good: 何のログかまで名前に入れる
resource "aws_s3_bucket" "cloudtrail_logs" {
  bucket = "acme-cloudtrail-logs"
}
```

なぜ: resource のアドレス（`aws_s3_bucket.cloudtrail_logs`）は state のキーなので、後から改名すると `moved` block を書くか、作り直しになる。1 件目のときに種類の名前を付けると、2 件目が来た時点で改名を迫られる。

1 つしか存在し得ない resource（AWS Organizations の organization など）は `this` でよい。
