---
name: kstack-rest-api
description: HTTP / REST API の route を設計する・書く・修正する・レビューするときの規約。1 つの route に返させるリソース（テーブル）の範囲、画面用の集計（件数・最新・先頭）を API と client のどちらで組み立てるか、親 id を複数受ける一括取得 route、path パラメータと query パラメータの使い分け（複数 id の渡し方）、request schema（validator）の transform で path・query・body を use case の型に変換する境界の書き方を扱う。Hono・Express などフレームワークを問わず、URL・エンドポイントの追加、handler・validator の作成、一覧画面のための API 作成、レビュー指摘への対応でも発火させる。
---

# kstack-rest-api

HTTP API の route を設計するときの規約。理由を理解した上で適用すること。

## 1 つの route は 1 つのリソースだけを返し、画面用の集計は client で組み立てる

一覧画面が親ごとの件数・最新・先頭を出したいとき、複数テーブルを JOIN・集計して画面の形で返す route を作らない。リソース（テーブル）ごとに、親 id を複数受けてその行をまとめて返す一括取得 route を置き、件数や最新の組み立ては client が行う。

```text
Bad: 画面専用の集計 route が items・payments・shipments を跨いで読む
GET /api/orders/summary
→ { orders: [{ id, itemCount, latestPayment, firstShipment }] }

Good: リソースごとの一括取得 route を並べ、client が組み立てる
GET /api/items?order_id=o1&order_id=o2      → { items: [...] }
GET /api/payments?order_id=o1&order_id=o2   → { payments: [...] }
GET /api/shipments?order_id=o1&order_id=o2  → { shipments: [...] }
```

なぜ: 1 つの route が複数テーブルを跨ぐと、画面の要件が増えるたびにその SQL と返り値が膨らみ、route が特定の画面に縛られる。リソースごとの route は単純なまま別の画面からも使い回せ、表示の都合の変更が client の中で完結する。

権限の確認のために親テーブル（所有者を持つテーブル）を読むのは「1 つのリソース」に含める。一括取得 route は id の個数に上限を置き（DB の bind 数の上限などに合わせる）、呼び出し元が見られない id は 404 にせず結果から黙って除く。一括取得では、1 つの id のために全体を失敗させず、存在しない id と見られない id を同じ「結果に無い」として扱える。

## path は 1 つのリソースを指し、一覧の絞り込みは query で受ける

path パラメータは「どのリソースか」を 1 つに決めるときに使う。一覧を条件で絞る値は、id であっても query で受ける。複数の id は同じキーを繰り返して渡し、カンマ区切りにしない。

```text
Bad: 複数 id を path にカンマ区切りで載せる
GET /api/items/o1,o2,o3

Good: 1 つの親の一覧は path、複数の親での絞り込みは query の繰り返しキー
GET /api/orders/o1/items
GET /api/items?order_id=o1&order_id=o2&order_id=o3
```

なぜ: `/api/items/:id` の形は「1 つの item」を指すように読め、`/api/orders/:id/items/:item_id` のような単一リソースの route と紛らわしい。path に載せた列は split と検証を自前で書くことになるが、繰り返しキーの query ならフレームワークの validator と型付き client が配列をそのまま扱える。

## request schema で use case が使う型に変換し、handler に HTTP の形を持ち込まない

path・query・body の値は、request schema（validator）の transform で use case がそのまま使える型（`string[]`・`number`・`boolean`・`Date`）に変換する。HTTP でしか意味を持たない形（数値の文字列、`"true"`、カンマ区切り、1 件だと string で複数だと array になる query、日付の文字列）を handler と use case で解釈しない。

```ts
// Bad: handler が HTTP の文字列を解釈している
app.get("/api/items", async (c) => {
  const orderIds = c.req.query("order_id")?.split(",") ?? [];
  const limit = Number(c.req.query("limit"));
  return c.json(await listItems({ orderIds, limit }));
});

// Good: schema が変換し、handler は受け取って渡すだけ
const id = v.pipe(v.string(), v.nonEmpty());
const querySchema = v.object({
  // キーが 1 回なら string、繰り返すと array で届くので配列にそろえる
  order_id: v.pipe(
    v.union([id, v.array(id)]),
    v.transform((value) => {
      if (typeof value === "string") {
        return [value];
      }
      return value;
    }),
  ),
  limit: v.pipe(v.string(), v.toNumber(), v.integer()),
});

app.get("/api/items", vValidator("query", querySchema), async (c) => {
  const { order_id: orderIds, limit } = c.req.valid("query");
  return c.json(await listItems({ orderIds, limit }));
});
```

なぜ: 変換する場所が境界の 1 か所にそろい、use case は HTTP を知らずにテストできる。誤った値は handler に届く前に 400 で弾かれ、`Number("abc")` の `NaN` のような値が奥まで流れない。
