---
name: kstack-better-result
description: better-result ライブラリ（Result 型）を使う TypeScript コードを設計する・書く・修正するときの規約。Result.gen による generator-based 合成の書き方（yield* するステップや条件分岐ごとの空行・コメントによる区切りを含む）、Result.tryPromise / Result.try で包む処理の粒度、エラーの種類の分け方（扱いを変える失敗は返す時点で別の TaggedError にし、isXxx のような判定関数で後から分類しない）、失敗（parse できない入力・例外）を null / undefined で返さず Result の Err で返すことを扱う。better-result の import、Result 型のエラー処理、fallible なステップの連結、例外を投げる処理や null で失敗を返す処理の Result 化、TaggedError の定義、エラーの種類に応じたログレベル・リトライ・レスポンスの出し分けを含むコードや設計書を書く・レビューする場面では必ず使用すること。
disable-model-invocation: false
---

# kstack-better-result

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
- エラー型は手書きしない。yield した Err と return した Result から自動 union される（kstack-typescript skill の「戻り値の型アノテーションは書かない」と整合）
- 非同期ステップは `Result.gen(async function* () { ... })` の中で `yield* await promise` で受ける。`Result.await(promise)` を挟まない

  ```ts
  // Good: await を直接 yield* する
  const run = yield* await this.runs.find();

  // Bad: 等価なのに冗長なラップを挟む
  const run = yield* Result.await(this.runs.find());
  ```

  なぜ: `yield* await p` は `yield* Result.await(p)` と完全に等価（ライブラリの `Result.await` 自体が `yield* await p` を返すだけ）で、 await の対象がその場で読める。ラップを挟むとノイズになるだけ

## Result.gen のステップと分岐は空行で区切り、意図をコメントする

`Result.gen` の body では、`yield*` する Result 呼び出しと条件分岐を 1 つの塊とし、塊の間に空行を入れ、各塊の先頭にその塊の意図を 1 行コメントで書く。

```ts
// Bad: ステップと分岐が詰まっていて、どこで何を判断しているか読み取りにくい
Result.gen(async function* () {
  const judged = yield* await placements.findByArticle({ articleId });
  if (judged !== undefined) {
    return Result.ok({ status: "skipped" as const });
  }
  const page = yield* await pages.fetch({ articleId });
  yield* await placements.save({ articleId, page });
  return Result.ok({ status: "judged" as const });
});

// Good: 塊ごとに空行とコメントで区切る
Result.gen(async function* () {
  // 判定済みかを確認する
  const judged = yield* await placements.findByArticle({ articleId });

  // 判定済みなら再判定せずスキップする
  if (judged !== undefined) {
    return Result.ok({ status: "skipped" as const });
  }

  // 判定対象のページを取得する
  const page = yield* await pages.fetch({ articleId });

  // 判定結果を保存する
  yield* await placements.save({ articleId, page });

  return Result.ok({ status: "judged" as const });
});
```

なぜ: `yield*` の各行はどれも Err で short-circuit しうる境界で、分岐は処理の行き先を変える境界。それらを空行とコメントで見出し化すると、generator の一本道が「何を取り、何を判断し、何を書くか」の手順として上から読める。コメントはコードの言い換えではなく、その塊の目的（なぜ取るか・なぜ抜けるか）を書く。

## 単一ステップは map / andThen で十分

fallible なステップが 1 つだけなら generator を使わず `map` / `andThen` でよい。全てを `Result.gen` にするのは過剰。

## Result.tryPromise には処理を 1 つだけ書く

`Result.tryPromise` / `Result.try` の `try` に複数の処理を詰めず、例外を投げうる処理ごとに包んで `Result.gen` で繋げる。

```ts
// Bad: id 生成と insert が 1 つの try に入り、どちらの失敗も DbQueryError になる
const save = (args) =>
  Result.tryPromise({
    try: async () => {
      const id = await hashId(args);
      await db.insert(users).values({ id, ...args });
    },
    catch: (cause) => new DbQueryError({ cause }),
  });

// Good: 処理ごとに包み、失敗をそれぞれのエラー型で返す
const save = (args) =>
  Result.gen(async function* () {
    const id = yield* await Result.tryPromise({
      try: async () => await hashId(args),
      catch: (cause) => new HashIdError({ cause }),
    });
    yield* await Result.tryPromise({
      try: async () => await db.insert(users).values({ id, ...args }),
      catch: (cause) => new DbQueryError({ cause }),
    });
    return Result.ok(id);
  });
```

なぜ: `catch` は 1 つしかないため、`try` に複数の処理があるとどこで失敗しても同じエラーに丸められ、DB と無関係な失敗まで `DbQueryError` として報告される。処理ごとに包めば失敗箇所がエラー型に表れ、`Result.gen` がそれらを union するので呼び出し側で区別して扱える。

## 扱いを変える失敗は、返す時点で別の TaggedError にする

呼び出し側で扱い（ログレベル、リトライ、レスポンス）を変える失敗は、失敗を検出した時点で専用の TaggedError として返す。汎用のエラーに status や message を詰めて返し、`isNotFound(error)` のような判定関数や `error.status === 404` の分岐で後から分類しない（設計段階でも同じ）。

```ts
// Bad: 404 も 500 も ApiResponseError に詰め、呼び出し側が status を見て分類し直す
if (!res.ok) {
  return Result.err(new ApiResponseError({ status: res.status, message: await res.text() }));
}

// false 側では 500 の ApiResponseError も型から消え、DbQueryError だけになる
const isNotFound = (error: ApiResponseError | DbQueryError): error is ApiResponseError =>
  error._tag === "ApiResponseError" && error.status === 404;

// Good: status を読んだ client が、その場で意味ごとのエラーを返す
if (res.status === 404) {
  return Result.err(new UserNotFoundError({ userId, message: `user ${userId} not found` }));
}
if (!res.ok) {
  return Result.err(new ApiResponseError({ status: res.status, message: await res.text() }));
}

// 呼び出し側は _tag で分ける。エラーの種類が増えると match が型エラーで知らせる
result.error.match({
  UserNotFoundError: (error) => console.warn(error.message),
  ApiResponseError: (error) => console.error(error.message),
  DbQueryError: (error) => console.error(error.message),
});
```

なぜ: エラーを値で返すのは、起きうる失敗を型に載せて呼び出し側に扱わせるため。後から判定すると意味が status や message の値に埋もれ、判定の呼び忘れや分類の漏れを型検査で検出できない。status の意味を知るのは client なので、分類も client で済ませる。

## 失敗を null / undefined で返さず、Result の Err で返す

parse できない入力や例外のような失敗は、`null` / `undefined` に潰して返さず、`Result.try` などで包んで TaggedError の `Err` で返す。呼び出し側は `isErr()` で分ける。「見つからない」のような正常な結果を `null` で返すのは対象外。

```ts
// Bad: 失敗を null に潰し、なぜ読めなかったかが呼び出し側に残らない
private parse(text: string) {
  try {
    return JSON.parse(text) as Payload;
  } catch {
    return null;
  }
}

// Good: 失敗を TaggedError の Err で返す
class PayloadParseError extends TaggedError("PayloadParseError")<{ cause: unknown; message: string }>() {}

private parse(text: string) {
  return Result.try({
    try: () => JSON.parse(text) as Payload,
    catch: (cause) => new PayloadParseError({ cause, message: "payload を JSON として読めない" }),
  });
}

const payload = this.parse(text);

if (payload.isErr()) {
  return this.reconnect();
}
```

なぜ: `null` は「失敗した」ことしか伝えず、原因が消えるうえ、正常な「無い」との区別も型に残らない。`Err` で返せば失敗の種類が型に載り、`cause` から原因を辿れる。
