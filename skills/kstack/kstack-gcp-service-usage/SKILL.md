---
name: kstack-gcp-service-usage
description: GCP Service Usage（Google Cloud API の有効化・管理）を作成・修正・レビューするときの運用規約。gcloud services enable の作業や初回 apply の準備に加え、Terraform の google_project_service で GCP API を有効化・管理しようとする場面でも必ず使用すること。AWS・Azure のサービス管理は対象外。
---

# kstack-gcp-service-usage

## GCP API は初回 apply 前に gcloud で有効化し、手順を AGENTS.md に置く

GCP API の有効化は `google_project_service` で管理せず、初回 `terraform apply` 前に `gcloud services enable` で行う。対象 API と実行手順は当該 repo の `AGENTS.md` に置く。これは user の運用規約であり、Terraform の機能上の制約ではない。

```hcl
# Bad: API の有効化を Terraform の管理対象にする
resource "google_project_service" "secret_manager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"
}
```

````md
<!-- Good: 当該 repo の AGENTS.md に、対象 API と初回 apply 前の手順を置く -->

## GCP の初期設定

初回 terraform apply 前に、対象 project の Secret Manager API を有効化する。

```sh
gcloud services enable secretmanager.googleapis.com --project="$GOOGLE_CLOUD_PROJECT"
```
````

なぜ: API の有効化を初回セットアップの運用に分け、Terraform の管理対象に含めないため。対象 API と手順を repo に残せば、別の作業者も同じ前提を再現できる。
