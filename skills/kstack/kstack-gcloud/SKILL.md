---
name: kstack-gcloud
description: gcloud（Google Cloud CLI）と Application Default Credentials（ADC）の認証を repo ごとに分ける規約。複数の GCP アカウント・組織を 1 台で使うときに、mise.toml の [env] で CLOUDSDK_CONFIG と GOOGLE_APPLICATION_CREDENTIALS を repo 専用のディレクトリに向けること、gcloud auth login と gcloud auth application-default login を mise タスク経由で実行することを扱う。gcloud・ADC・Terraform の google provider・Google API のクライアントライブラリの認証を設定・修正・レビューするとき、「他の project の認証と競合する」「application-default login しろと言われる」ときに使う。
---

# kstack-gcloud

gcloud と ADC の認証を repo ごとに分けるときの規約。理由を理解した上で適用すること。GCP API の有効化は `kstack-gcp-service-usage`、タスクの書き方は `kstack-mise-tasks` にある。

## 認証の置き場所を repo ごとに分け、CLOUDSDK_CONFIG と GOOGLE_APPLICATION_CREDENTIALS の両方を向ける

gcloud を使う repo（monorepo なら GCP を扱うディレクトリ）の `mise.toml` の `[env]` で、`CLOUDSDK_CONFIG` を repo 専用のディレクトリに、`GOOGLE_APPLICATION_CREDENTIALS` をそのディレクトリの `application_default_credentials.json` に向ける。ディレクトリは repo の外（`~/.config/gcloud-<名前>`）に置き、認証情報を作業ツリーに入れない。

```toml
# Bad: CLOUDSDK_CONFIG だけを分ける（Terraform の google provider は共有の ~/.config/gcloud の ADC を読む）
[env]
CLOUDSDK_CONFIG = "{{env.HOME}}/.config/gcloud-acme"
```

```toml
# Good
[env]
CLOUDSDK_CONFIG = "{{env.HOME}}/.config/gcloud-acme"
GOOGLE_APPLICATION_CREDENTIALS = "{{env.HOME}}/.config/gcloud-acme/application_default_credentials.json"
```

なぜ: 既定の `~/.config/gcloud` はマシンで 1 つなので、ある repo で login すると、別のアカウントで動いている他の repo の session の認証を上書きする。ADC を読む側には `CLOUDSDK_CONFIG` を見ないものがある（Terraform の google provider や Go・Node のクライアントライブラリは `GOOGLE_APPLICATION_CREDENTIALS`、既定の `~/.config/gcloud`、metadata server の順に探す）ので、`GOOGLE_APPLICATION_CREDENTIALS` も向けて、どの読み手も同じファイルを読むようにする。

## login は mise タスクで実行し、gcloud CLI と ADC の両方を取る

login は `[env]` と同じ設定から env が入るタスクで実行し、素の shell で `gcloud auth login`・`gcloud auth application-default login` を打たない。gcloud CLI の認証と ADC は別物なので、タスクで両方を取る。タスクの置き場所と呼び出し方は `kstack-mise-tasks` に従う（repo root なら `.config/mise/tasks/` に置いて `mise run login`、monorepo の config root なら `[env]` と同じ `mise.toml` に置いて repo root から `mise run //<path>:login`）。

```toml
# Good: infra/gcp/mise.toml
[tasks.login]
description = "Log in gcloud CLI and ADC for this repo"
interactive = true
run = [
  "gcloud auth login",
  "gcloud auth application-default login",
]
```

```text
Bad: env が効いていない shell で gcloud auth application-default login を実行する / 上書きした ADC を mv して戻そうとする
Good: mise run //infra/gcp:login を実行し、gcloud auth list と ADC のアカウントを確かめてから apply する
```

なぜ: env が効いていない場所で実行すると、共有の `~/.config/gcloud` に書き込んで他の repo の認証を壊す。mise タスクはどのディレクトリから呼んでもその config root の `[env]` が入る。`gcloud services enable` などの CLI 操作は CLI の認証を、provider とクライアントライブラリは ADC を使うので、片方だけでは途中で失敗する。
