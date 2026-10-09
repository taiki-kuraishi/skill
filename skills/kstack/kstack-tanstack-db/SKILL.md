---
name: kstack-tanstack-db
description: TanStack DB（@tanstack/react-db、@tanstack/db）の live query を書く・修正する・レビューするときの規約。useLiveQuery の呼び方（config 形式で書き、deps 配列を使わない）、渡す query の組み立て（入力が揃わないときの無効化、where に渡す式、and・eq・inArray の合成、任意のフィルタの足し方）、無効化された query の isLoading の扱いを扱う。collection からの読み取り、ユーザーや選択中の項目などの入力に依存する query、ローディング表示や空表示の判定、InvalidWhereExpressionError、レビュー指摘への対応でも発火させる。
---

# kstack-tanstack-db

[TanStack DB](https://tanstack.com/db/latest) の live query を書くときの規約。理由を理解した上で適用すること。`useLiveQuery` を置く場所（view の hook の中）は kstack-react の SKILL を参照。

## 無効化は query ごと undefined にし、where には常に完全な式を渡す

入力が揃わないときは、先頭のガード句で query ごと `undefined` を返して無効化する。条件に応じて `.where()` を足し引きして query の形を変えず、`.where()` には常に完全な式を渡す。任意の条件も、どの分岐でも完全な式を返し、`and()` で合成する。

```ts
// Bad: where の中で undefined を返している。undefined は式ではないので InvalidWhereExpressionError で throw する
useLiveQuery({
  query: (q) =>
    q.from({ todo: todos }).where(({ todo }) => {
      if (userId === null) {
        return undefined;
      }
      return eq(todo.userId, userId);
    }),
});

// Good: 入力が揃わなければ query ごと無効化し、where にはどの分岐でも完全な式を返す
useLiveQuery({
  query: (q) => {
    if (userId === null) {
      return undefined;
    }
    return q.from({ todo: todos }).where(({ todo }) => {
      const active = and(eq(todo.userId, userId), eq(todo.archived, false));
      if (status === null) {
        return active;
      }
      return and(active, eq(todo.status, status));
    });
  },
});
```

なぜ: `.where()` は式を要求し、`undefined` を返すと throw する。query が動くかどうかは先頭のガード句 1 か所、何で絞るかは where の中の式、と分けておけば、どの入力が欠けたら止まるかと、絞り込みの条件を別々に読める。

## 無効化された query の isLoading は false。無効化の条件も loading に含める

無効化された query は読み込み中ではないので `isLoading: false` を返す。query 側の `isLoading` だけを見ると、入力が決まる前の状態が「0 件」の空表示として描かれる。hook が返す `isLoading` には、無効化の条件を含める。

```ts
const { data, isLoading } = useLiveQuery({
  query: (q) => {
    if (userId === null) {
      return undefined;
    }
    return q.from({ todo: todos }).where(({ todo }) => eq(todo.userId, userId));
  },
});

// Bad: 無効化中は isLoading が false なので、userId が決まる前に空表示が出る
return { todos: data ?? [], isLoading };

// Good: 無効化の条件も loading に含める
return { todos: data ?? [], isLoading: userId === null || isLoading };
```

例外は、入力が決まらない状態が正常に続く画面（選択が無いまま使うのが普通の画面）。無効化を loading に含めると永久に読み込み中のままになるので、loading にはせず、その状態の表示を出す。0 件や「見つかりません」の表示のほか、登録フォームのように、その画面の通常の内容を出してもよい。

なぜ: 無効化された query は何も読んでいないだけで読み込み中ではないので、`isLoading` は立たない。view にとっては「まだ何も読めていない」状態で、「読んだ結果が 0 件」の空表示とは別物。

## useLiveQuery は config 形式で書き、deps 配列を渡さない

`useLiveQuery({ query: (q) => ... })` の config 形式で書き、第 2 引数の deps 配列は使わない。closure の値（選択中の id など）は式に埋め込めば query の identity に入り、値が変わると再実行される。

```ts
// Bad: deps 配列を渡している
useLiveQuery(
  (q) => q.from({ todo: todos }).where(({ todo }) => eq(todo.userId, userId)),
  [userId],
);

// Good: config 形式。userId は式に埋め込まれるので deps は要らない
useLiveQuery({
  query: (q) => q.from({ todo: todos }).where(({ todo }) => eq(todo.userId, userId)),
});
```

なぜ: react-db は deps 配列を型定義で deprecated と明記している。config 形式なら、query の identity が式そのものから決まるので、deps の書き忘れで古い値の query が残ることがない。
