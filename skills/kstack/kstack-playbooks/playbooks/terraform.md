# Terraform を変えて plan を PR に出す

**持つもの: `.tf` の変更と、plan の結果を書いた PR まで。apply・import・state の操作は持たない。**

使う場面: `.tf` を変え、`terraform plan` の結果を添えて PR を出す。1 回で扱う root module は 1 つにする。Terraform の是非を調べるだけなら調査の playbook、CI の plan の job が落ちたなら CI の失敗の playbook で扱う。

1. 変える対象を決める。root module・module・resource・値を書き出し、依頼・文書に無い値は `kstack-playbooks` の「playbook の回し方」の手順 2 で聞く。root module を新しく作る・分ける・名前を変えるときは、`kstack-terraform` の「root module の分け方は user と相談して決める」のとおり案を並べて聞く。完了条件: 変える `.tf` の一覧ができ、各値に出典か user の答えがある
2. 認証を用意する。`kstack-gcloud` のとおり repo の login の task を使う。GCP の API が要るなら、`kstack-gcp-service-usage` のとおり repo の AGENTS.md にある有効化の手順を確かめる
3. `.tf` を書く（`kstack-terraform`）。resource の名前を変えるときは `moved` を書く。完了条件: `tflint` の指摘が 0 件で、`terraform fmt -check -recursive` が通る
4. plan を取る。`terraform init` と `terraform plan` を実行する。plan は環境を変えないので、聞かずに実行する。完了条件: `Plan: N to add, M to change, K to destroy` の行が出ている
5. plan を読む。destroy・replace が出たら、意図した変更か、データが消えないかを聞く。依頼に無い差分（手で変えた設定とのずれなど）が出たときも聞く。import や state の操作が要るときも、ここで止まって聞く。完了条件: destroy・replace・依頼に無い差分が 0 件か、それぞれに user の答えがある
6. PR を出す。読み込んだ mode の出し方に従う（bot は `kstack-bot-driven-development` の「フェーズを stack に積む」、それ以外は `kstack-git` の「PR の作り方」）。body の「確認方法」に、plan の件数と変わる resource の名前、実行した環境とコマンドを書く。plan の出力ファイルと一時的な tfvars は commit しない。apply は user の明示の指示があるときだけ行う

```text
Bad: plan に replace が出たが、依頼どおりの変更なので PR を出し、apply まで進める
Good: replace の resource と消えるデータがあるかを聞き、PR に plan の要約を書いて、apply は指示を待つ
```

なぜ: Terraform の変更で戻せないのは apply である。plan を読んで消えるものを PR の前に止めれば、user は差分を見て apply するかを決められる。

**報告**: 変えた root module と resource、plan の件数、destroy・replace と聞いて決めたこと、PR の URL。
