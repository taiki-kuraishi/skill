---
name: kstack-tanstack-query
description: TanStack Query（@tanstack/react-query）の hooks を書く・修正する・レビューするときの規約。API を呼ぶ useQuery・useMutation を app に直書きせず、hooks を配る専用 package（api-query など）に置き、app はそれを呼んで表示の形に整えるだけにする構成を扱う。queryKey・queryFn・mutationFn を書く場面、monorepo で hooks を共有する package の新設と構成（client を運ぶ Provider、1 route 1 file、index.ts の公開面、peerDependencies）、QueryClientProvider の置き場所、QueryClient の既定（throwOnError で失敗を Error Boundary に投げる）、mutation hook の options と invalidateQueries、レビュー指摘への対応では必ず使用すること。
---

# kstack-tanstack-query

[TanStack Query](https://tanstack.com/query/latest) の hooks を書くときの規約。理由を理解した上で適用すること。package の新設は kstack-monorepo、責務の書き方は kstack-readme、`useQuery` の読み込み中の判定（`useSuspenseQuery` を使わない理由）は kstack-react、Hono の型付きクライアントは kstack-hono の SKILL を参照。

## API を呼ぶ hooks は app に書かず、hooks を配る package に置く

API を呼ぶ `useQuery`・`useMutation` と、その `queryKey`・`queryFn`・`mutationFn` は app に書かない。API の package ごとに hooks を配る package（`@acme/api` なら `@acme/api-query`）を作り、API の route 1 つにつき hook を 1 つ置く。app の hook はそれを呼んで、結果を表示の形に整えるだけにする。

```ts
// Bad: app の hook が queryKey と route の呼び出しを持っている
export function useTodoList() {
  const { data } = useQuery({
    queryKey: ["todos"],
    queryFn: () => apiClient.api.todos.$get().then((res) => res.json()),
  });
  // ...data を表示の形に整えて返す
}

// Good: package の query hook は queryKey と queryFn だけを持ち、useQuery の結果をそのまま返す
export const useTodosQuery = () => {
  const client = useApi();

  return useQuery({
    queryKey: ["todos"],
    queryFn: () => parseResponse(client.api.todos.$get()),
  });
};

// Good: mutation hook は options を受け取って展開し、query の無効化は呼び出し側に任せる
type Route = ApiClient["api"]["todos"]["$post"];
type Variables = InferRequestType<Route>;
type Data = InferResponseType<Route, 201>; // 成功 status は route ごとに指定する
type Options = Omit<UseMutationOptions<Data, Error, Variables>, "mutationFn">;

export const useCreateTodo = (options?: Options) => {
  const client = useApi();

  return useMutation<Data, Error, Variables>({
    ...options,
    mutationFn: (variables) => parseResponse(client.api.todos.$post(variables)),
  });
};

// Good: app の hook は package の hook を呼び、読み込み中の判定と表示の形への整形だけをする
export function useTodoList() {
  const { data } = useTodosQuery();

  if (data === undefined) {
    return { status: "loading" } as const;
  }
  const todos = data.todos.map((todo) => ({ id: todo.id, label: todo.title ?? "Untitled" }));
  return { status: "ready", todos } as const;
}
```

- package の hook に入れるのは `queryKey` と `queryFn`（mutation なら `mutationFn`）だけ。非 2xx は `parseResponse` が `DetailedError` を投げるので、エラーの変換・retry・整形は入れない。整形は画面ごとに違うので app の hook が持つ。`placeholderData` のように画面ごとに変わる query の options は、mutation hook と同じく `options` で受けて展開する
- query hook の `data` は 200 の body か、読み込み中の `undefined` になる。`undefined` は読み込み中だけを表すので、見つからないことを値で返す route は `null` を返す（`data` は body | `null` | `undefined`）。queryFn が `undefined` で解決すると TanStack Query はエラーにする
- `invalidateQueries` は呼び出し側が `onSuccess` で行う。どの query を無効化すべきかは画面ごとに違い、package は知らない
- 型は手書きしない（kstack-typescript）。`Variables` と `Data` は `InferRequestType` / `InferResponseType` から導出し、hc の引数（`{ param, json }`）を `{ id, body }` のように平らにしない

なぜ: queryKey・route・エラーの扱いが画面の hook に混ざると、同じ API を読む画面や app ごとに重複し、API が変わったときの修正箇所が散らばる。API を呼ぶ層を package に切り出せば、app は受け取った結果をどう表示するかだけを書く。

## package は client を Provider から受け取る

hook は client を import や生成で得ず、`useApi()` で context から受け取る（provider の外で呼んだら throw する）。Provider は origin ではなく作り済みの client を受け取り、`QueryClientProvider` は app が持つ。

```tsx
// Bad: origin を渡し、package に client を作らせている。認証の付け方まで package が決めることになる
<ApiQueryProvider origin={import.meta.env.VITE_API_ORIGIN}>{children}</ApiQueryProvider>

// Good: app が作った client を渡す。QueryClientProvider も app が持ち、その内側に置く
<QueryClientProvider client={queryClient}>
  <ApiQueryProvider client={apiClient}>{children}</ApiQueryProvider>
</QueryClientProvider>
```

なぜ: origin・認証（credentials や `Authorization`）・QueryClient の設定（retry、staleTime）は app ごとに違う。それらを app が決めれば、package は app を知らずに hooks を配るだけで済み、どの app からも同じ hooks を使える。

## data が無いまま失敗した query は、QueryClient の既定で Error Boundary に投げる

`useQuery` は既定で失敗を `error` に入れて返すだけで、`data` は `undefined` のまま残る。app の `QueryClient` の `defaultOptions.queries.throwOnError` に、`data` が無いときだけ投げる関数を渡す。package の hook や app の hook には `throwOnError` を書かない。

```ts
// Bad: true だと、表示済みのデータがある再取得の失敗でも投げ、表示中の内容を Error Boundary で置き換える
new QueryClient({ defaultOptions: { queries: { throwOnError: true } } });

// Good: data が無いときの失敗だけを Error Boundary（route の errorComponent など）へ投げる
new QueryClient({
  defaultOptions: {
    queries: { throwOnError: (_error, query) => query.state.data === undefined },
  },
});
```

なぜ: 投げなければ、view の hook は `data === undefined` を読み込み中と判定するので、失敗した画面は読み込み中のまま止まる。境界に任せれば hook は `error` を分岐せずに済み、再取得が失敗しても表示済みの内容は残る（`useSuspenseQuery` の既定と同じ振る舞い）。エラーの扱いは retry と同じく app ごとに決めるので、package ではなく QueryClient に置く。

## 1 route = 1 file にし、index.ts に公開する名前を列挙する

```text
packages/api-query/src/
├── index.ts                      # 公開面。named export を列挙する（export * は使わない）
├── context.ts                    # client を運ぶ context
├── provider.tsx                  # <ApiQueryProvider client={client}>
├── use-api.ts                    # context から client を取る
├── query/use-todos-query.ts      # 一覧は複数形、1 件は単数（use-todo-query.ts）
└── mutation/use-create-todo.ts   # use-<動詞>-<リソース>.ts
```

リソースごとのサブディレクトリは切らない。hook を足す手順は、既存の hook をコピーして route を変え、`index.ts` に named export を 1 行足すだけにする。テストは書かない。hook は client の呼び出しを包むだけで分岐を持たず、契約は導出した型と `type-check` が守る。

なぜ: 変更が「ファイル 1 つ + `index.ts` 1 行」に収まり、どの route の hook かをファイル名から探せる。`export *` だと、ファイルに足した export が意図せず公開面に混ざる。

## @tanstack/react-query と react は peer にし、API の package は型だけ import する

```jsonc
// Bad: package が自前の react-query を持ち、API の package も実行時の依存にしている
{ "dependencies": { "@tanstack/react-query": "^5.0.0", "@acme/api": "workspace:*" } }

// Good: react-query・react は peer。API の package は型の import だけなので devDependencies
{
  "dependencies": { "hono": "catalog:" },
  "devDependencies": { "@acme/api": "workspace:*", "@tanstack/react-query": "catalog:" },
  "peerDependencies": { "@tanstack/react-query": "catalog:", "react": "catalog:" }
}
```

API の package は `import type` だけで読み、値の import は書かない。

なぜ: context は `@tanstack/react-query` のモジュールごとに作られるので、package が別のコピーを持つと app の `QueryClientProvider` とは別の context を見て、hook が `No QueryClient set` で落ちる。API の package を型だけの依存にすれば、サーバーのコードがブラウザの bundle に入らない。
