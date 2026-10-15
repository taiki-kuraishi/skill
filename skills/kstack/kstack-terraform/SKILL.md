---
name: kstack-terraform
description: Terraform（.tf ファイル、HCL）と tflint 設定（.tflint.hcl、tflint-ruleset-opa の Rego ポリシー）を書く・修正する・レビューするときの規約。リテラル値に名前を付けるときは locals ではなく default 付きの variable にすること、resource を S3・KMS・IAM のようにサービス名の module にまとめて root に resource を残さないこと、root module（state の単位）の分け方とディレクトリ名を agent が決めずに user と相談すること、provider ブロックを provider.tf に置き versions.tf を terraform ブロックだけにすること、root に output を書かず module の output を呼び出し側で参照するものだけにすること、module 内を bucket などの主リソースごとのファイルに分けること、同じ種類の resource が増えても衝突しない名前を付けること、Secret Manager などの secret 名に tf-var のような使う側の prefix を入れないこと、tflint に provider 公式の ruleset plugin を version・source 付きで入れ deep_check を有効にすることを扱う。AWS・GCP・Cloudflare などのインフラや root module（stack）の追加、module 化やファイル分割のリファクタリング、lint 設定、レビュー指摘への対応でも発火させる。
---

# kstack-terraform

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

resource は provider のサービスごとの module（S3 なら `modules/s3`、IAM なら `modules/iam`、GCP の KMS なら `modules/gcp/kms`）に置き、root は module を呼ぶだけにする。別サービスのための resource も、resource type のサービスの module に置く（Secret Manager の service agent に KMS key を使わせる IAM binding は `iam` module）。

```text
# Bad: 用途の名前のファイルに、複数サービスの resource が混ざる
logging.tf    # aws_s3_bucket、aws_iam_role、aws_cloudwatch_log_group

# Good: サービス名の module に分け、root の main.tf から module "s3" { source = "./modules/s3" } のように呼ぶ
modules/
├── s3/
├── iam/
└── cloudwatch/
```

なぜ: resource type から置き場所が一つに決まるので、探すときも足すときも迷わない。用途や「どのサービスの関心か」で切ると境界の引き方が人によって変わり、root に残った resource から置き場所の規則が崩れる。

## root module の分け方は user と相談して決める

root module（state の単位）を新しく作る・分ける・改名するときは、agent が決めずに案を示して user に決めてもらう。既定の案は provider 別（`infra/aws`、`infra/cloudflare`）とし、用途やプロジェクトで分ける案があれば並べて示す。

```text
# Bad: 相談せずに root module を作り、backend の key も決めて進める
infra/events/    # key = "events/terraform.tfstate"

# Good: 案を示して決めてもらう
「root module は provider 別（infra/aws、infra/cloudflare）を既定に考えています。
  用途で分けるなら infra/events/ です。どちらにしますか？」
```

なぜ: root module は state・backend の key・apply の単位を決め、後から改名や分割をすると state の移行（`init -migrate-state` など）が要る。provider 別が多くの場合に合うが、どの単位で分けるかは運用で変わり、コードからは決まらない。

## provider ブロックは provider.tf に置き、versions.tf は terraform ブロックだけにする

```hcl
# Bad: versions.tf に provider の設定が混ざる
# versions.tf
terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.27.0" }
  }
}
provider "cloudflare" {}

# Good: versions.tf は required_version・backend・required_providers だけ
# versions.tf
terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.27.0" }
  }
}

# provider.tf
provider "cloudflare" {}
```

なぜ: versions.tf は「どの版で動かすか」、provider.tf は認証・region・assume_role など「どこに対して動かすか」で、変える理由が違う。分けておけば、provider を足す・region を変えるときに見るファイルが 1 つに決まる。

## root に output を書かず、module の output は呼び出し側で使うものだけにする

root module には `output` を書かない。module の `output` は、呼び出し側が `module.<name>.<output>` で参照するものだけを置く。

```hcl
# Bad: root の output と、どこからも参照されない module の output
output "crypto_key_id" { value = module.kms.crypto_key_id }  # env/gcp/outputs.tf
output "key_ring_name" { value = google_kms_key_ring.this.name }  # modules/kms/outputs.tf、参照なし

# Good: 呼び出し側が参照する output だけ
module "secret_manager" {
  source        = "../../modules/secret_manager"
  crypto_key_id = module.kms.crypto_key_id
}
```

なぜ: 使われない output は「誰かが読んでいるかも」と消せない公開 API になる。root の出力は module 間の受け渡しに要らず、値は console や `terraform state show` で確かめられる。

root の禁止は tflint-ruleset-opa で lint する。root ディレクトリごとに次の 2 ファイルを置き、module のディレクトリには置かない。root で `tflint --init && tflint`、または repo root で `tflint --recursive` を実行する。module の未参照 output は既存の lint では検出できないので、レビューで確かめる。

```hcl
# <root>/.tflint.hcl
plugin "opa" {
  enabled = true
  version = "0.11.0"
  source  = "github.com/terraform-linters/tflint-ruleset-opa"
}
```

```rego
# <root>/.tflint.d/policies/no_root_output.rego
package tflint
import rego.v1

deny_root_output contains issue if {
  some output in terraform.outputs({}, {})
  issue := tflint.issue(sprintf("root module に output %q を書かない", [output.name]), output.decl_range)
}
```

なぜ: `--recursive` は各ディレクトリに移って、そこの `.tflint.hcl` と `./.tflint.d/policies` を読む。root にだけ置けば module の output は検査されず、`TFLINT_OPA_POLICY_DIR` も要らない。

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

## secret の名前に使う側の都合を入れない

Secret Manager などの secret の名前は中身だけを表し、`tf-var` のような使う側の prefix は使う側（fnox の設定など）で付ける。

```hcl
# Bad: Terraform の変数として読む都合が secret 名に入る
secret_id = "tf-var-oauth-client-secret"

# Good: secret は中身の名前。TF_VAR_ への対応づけは読む側の設定で行う
secret_id = "oauth-client-secret"
```

なぜ: 同じ secret を Terraform 以外（アプリ、CI）でも読むと、名前の prefix が嘘になる。使い方が変わるたびに secret を作り直すことにもなる。

## tflint には provider 公式の ruleset を入れ、deep_check を有効にする

使う provider の公式 ruleset（`tflint-ruleset-aws`、`tflint-ruleset-google` など）を `version` と `source` 付きで入れ、`deep_check = true` にする。

```hcl
# Bad: terraform ruleset だけ。machine type や region の誤りを見ない
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# Good: 公式 ruleset を版固定で入れ、API で値を確かめる
plugin "google" {
  enabled    = true
  version    = "0.40.0"
  source     = "github.com/terraform-linters/tflint-ruleset-google"
  deep_check = true
}
```

なぜ: 存在しない instance type などの provider 固有の誤りは terraform ruleset では見つからず、apply まで気付けない。deep_check は provider の API で実在を確かめるので、CI では認証情報を渡す（`tflint --init` も未認証だと GitHub API の rate limit に当たるので `GITHUB_TOKEN` を渡す）。
