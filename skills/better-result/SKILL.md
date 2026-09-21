---
name: better-result
description: better-result ライブラリ（Result 型）を使う TypeScript コードを書く・修正するときの規約。Result.gen による generator-based 合成の書き方を扱う。better-result の import、Result 型のエラー処理、fallible なステップの連結、TaggedError を含むコードを書く・レビューする場面では必ず使用すること。
disable-model-invocation: false
---

# better-result

[better-result](https://better-result.dev)（Result 型ライブラリ）を書くときの規約。

## 複数の fallible なステップは Result.gen に繋げる

2 つ以上の fallible なステップを連結するときは、呼び出し側で小分けにせず、1 つの `Result.gen` の中にまとめて書く。公開メソッドはアロー関数プロパティで `Result.gen(...)` を直接返す。

```ts
// Bad: ステップごとに分割し、外側で繋げている
public execute = async (payload) => {
  const task = await this.fetchTask(payload);
  if (task.isErr) { ... }
  const key = await this.contentKey(task);
  ...
};

// Good: 1 つの Result.gen に全ステップを入れる
public execute = (payload) =>
  Result.gen(function* () {
    const task = yield* this.fetchTask(payload);
    const key = yield* this.contentKey(task);
    const log = yield* this.pageContentLog(key);
    return Result.ok(log);
  });
```

なぜ: `Result.gen` は最初の `Err` で自動 short-circuit し、全ステップのエラー型を自動で union する。if 分岐や try/catch での手動エラー処理を消し、「成功時の一本道」だけを読めるようにする。generator の中に `contentKey` のような後続ステップをそのまま書いてよい。

## Result.gen の規則

- unwrap は必ず `yield*`。plain `yield` は Result 全体を渡すことになり型エラーになる
- body の return は必ず `Result.ok(...)` / `Result.err(...)`。裸の値を返すと Panic（throw）する
- guard 句は Err を直接 yield して即 short-circuit: `if (!user.active) { yield* new InactiveUser({...}); }`
- エラー型は手書きしない。yield した Err と return した Result から自動 union される（typescript skill の「戻り値の型アノテーションは書かない」と整合）
- 非同期ステップは `Result.gen(async function* () { ... })` の中で `yield* await promise` で受ける。`Result.await(promise)` を挟まない

  ```ts
  // Good: await を直接 yield* する
  const run = yield* await this.runs.find();

  // Bad: 等価なのに冗長なラップを挟む
  const run = yield* Result.await(this.runs.find());
  ```

  なぜ: `yield* await p` は `yield* Result.await(p)` と完全に等価（ライブラリの `Result.await` 自体が `yield* await p` を返すだけ）で、 await の対象がその場で読める。ラップを挟むとノイズになるだけ

## 単一ステップは map / andThen で十分

fallible なステップが 1 つだけなら generator を使わず `map` / `andThen` でよい。全てを `Result.gen` にするのは過剰。
