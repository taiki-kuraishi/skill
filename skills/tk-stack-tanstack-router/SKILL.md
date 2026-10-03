---
name: tk-stack-tanstack-router
description: TanStack Router（@tanstack/react-router）のルートを書く・修正する・レビューするときの規約。beforeLoad・loader で Promise を await せず、認証の確認も待たずに子ルートを楽観的に描画する構成を扱う。createRoute・createFileRoute のルート定義、認証ガードやサインインへのリダイレクト、loader でのデータ取得・prefetch、pendingComponent の設定、レビュー指摘への対応でも発火させる。
---

# tk-stack-tanstack-router

[TanStack Router](https://tanstack.com/router/latest) を書くときの規約。理由を理解した上で適用すること。コンポーネントの中でのデータの待ち方（Suspense、楽観的な表示）は tk-stack-react の SKILL を参照。

## beforeLoad・loader で await しない

`beforeLoad`・`loader` は Promise を待たずに返す。loader はデータ取得を始めるだけにし（`prefetchQuery` を await しない）、結果はコンポーネントが `useSuspenseQuery` で読む。認証ガードも `beforeLoad` で確認を待たない。レイアウトは `<Outlet />` を先に描画し、セッションが無いと確定したときだけサインインへ送る（楽観的な表示）。

```tsx
// Bad: セッションの確認が返るまで、このルートと子孫は何も描画されない
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/sign-in" });
    }
  },
});

// Good: 子はすぐ描画し、セッションが無いと確定したときだけサインインへ送る
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: SessionGate,
});

function SessionGate() {
  // 確認中は data が undefined なので子を描画する。queryFn はセッションが無ければ null を返す
  const { data: session } = useQuery(sessionQuery);
  if (session === null) {
    return <Navigate to="/sign-in" />;
  }
  return <Outlet />;
}

// Good: loader は取得を始めるだけで、待たない
const projectRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "projects/$projectId",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(projectQuery(params.projectId));
  },
  component: ProjectPage,
});
```

なぜ: `beforeLoad` は親から子へ直列に実行され、終わるまで子の `beforeLoad` も `loader` も始まらない。await した往復の分だけ画面は空白（遷移なら前の画面）のまま止まり、`pendingComponent` も既定では 1 秒経つまで出ない。ルートのガードは表示の出し分けでしかなく、データは API 側の認可が守る。セッションが無ければ子の取得はどうせ失敗するので、確認を待たずに子を描画してよい。
