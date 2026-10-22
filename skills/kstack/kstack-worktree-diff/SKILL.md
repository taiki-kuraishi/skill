---
name: kstack-worktree-diff
description: worktree の diff・PR をレビューできる大きさに保つためのフェーズ分割の規約。API 実装を 1 フェーズ 1 endpoint、monorepo の workspace 変更を 1 フェーズ 1 package、UI の機能変更を同じ package 内でも画面ごとに分ける。実装計画・フェーズ案の作成や修正、複数 API・package・画面を含む実装、diff・PR のレビュー、差分が大きすぎるという指摘への対応で使用すること。
---

# kstack-worktree-diff

フェーズは実装する側の都合ではなく、user が差分を読み切って判断できる単位にする。

## 1 フェーズで実装する API は 1 つ

API を実装するフェーズは、HTTP method と path で特定した 1 endpoint に絞る。同じ resource の CRUD でも、一覧・作成・更新を別のフェーズにする。その API に必要な同一 package 内の route・業務処理・認可・テストは含め、API が動く状態を完了条件にする。

```text
Bad: backend 全体を 1 フェーズにまとめる
1 backend — GET /api/items, POST /api/items, PATCH /api/items/:id

Good: endpoint ごとに実装と確認を閉じる
1 list-items   — GET /api/items。認可を含め一覧を取得できる
2 create-item  — POST /api/items。認可を含め作成できる
3 update-item  — PATCH /api/items/:id。認可を含め更新できる
```

なぜ: 複数 API をまとめると、request・response・認可・異常系の確認が同時に増え、レビューで見落としやすくなる。endpoint 単位なら、1 つの振る舞いとその差分を対応付けて判断できる。

## 1 フェーズで変更する package は 1 つ

monorepo では workspace の設定から package 境界を確認し、package に触るフェーズの変更先を 1 つに絞る。1 つの機能でも DB・API・UI を同じフェーズで変えず、package ごとに分ける。他の package に必要な schema・型・export は先行フェーズで用意し、使う側の前提にする。

```text
Bad: API を 1 つに絞っても、複数 package の変更を含める
1 create-item — packages/db, packages/api, packages/web

Good: package の境界で分け、使う側は必要な前提を待つ
1 item-schema — packages/db。schema と export を用意する
2 create-item — packages/api。POST /api/items を実装する（前提 1）
3 item-form   — packages/web。作成 API に接続する（前提 2）
```

なぜ: 複数 package をまたぐ差分は、責務・依存・動作確認の対象が一度に広がる。package ごとにレビューできれば、前提の変更とそれを使う変更を分けて確認できる。

## UI の機能変更は画面ごとにフェーズを分ける

UI の機能変更は、同じ package 内でも画面ごとにフェーズを分ける。同じ機能に属する複数画面の変更も、1 フェーズにまとめない。各画面の操作・表示を確認できる状態を完了条件にする。

```text
Bad: 同じ機能・package なので、複数画面の変更をまとめる
1 item-search — packages/web。一覧画面と詳細画面の検索機能を変更する

Good: 同じ package 内でも画面ごとに実装と確認を閉じる
1 list-search   — packages/web。一覧画面の検索操作と表示を確認できる
2 detail-search — packages/web。詳細画面の検索操作と表示を確認できる
```

なぜ: 同じ機能でも画面が違えば、操作・表示・確認する差分が変わる。画面ごとに分けると、user が各画面の振る舞いと差分を対応付けてレビューできる。

## 計画とレビューで確かめる

- フェーズ案に対象 API・変更する package・対象画面・前提・完了条件を示し、上の 3 条件をすべて満たすまで分割する。API を実装しない schema・型・UI などのフェーズに API を足す必要はなく、画面を変更しないフェーズに対象画面を足す必要もない。
- 実装中に別 API・別 package・別画面の変更が必要になったら、フェーズ案を更新して分ける。同じ機能に必要という理由で、現在のフェーズへまとめない。
- レビューに出す diff・PR は 1 フェーズ分に区切る。実際の変更が対象 API・package・画面に収まっているか確認し、別フェーズの変更が混ざっていれば分離する。
