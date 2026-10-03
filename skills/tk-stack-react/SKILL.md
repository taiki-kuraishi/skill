---
name: tk-stack-react
description: React のコンポーネント・hooks を書く・修正する・レビューするときの規約。useEffect・useLayoutEffect を使わず、データ取得は TanStack Query（useSuspenseQuery）と Suspense、外部の状態の購読は zustand などの store に任せ、描画を止めない非同期・楽観的な UI を設計する。tsx でのデータ取得、ローディング表示、派生 state、ブラウザ API や外部ストアの購読、認証確認などの楽観的な表示、絞り込み・ページ送りなど再取得を伴う更新、レビュー指摘への対応でも発火させる。
---

# tk-stack-react

[React](https://react.dev/) のコンポーネントを書くときの規約。理由を理解した上で適用すること。ルーターの `beforeLoad`・`loader` の書き方は tk-stack-tanstack-router の SKILL を参照。

## useEffect を使わない。目的ごとの仕組みに置き換える

`useEffect`・`useLayoutEffect` と、それらを包んだ自作 hook を書かない。Effect で書きたくなる処理には、目的ごとの置き換え先がある。

| 目的                                       | 置き換え先                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| データ取得                                 | TanStack Query などのデータ取得ライブラリ（Suspense と組み合わせる。次の規約）              |
| props・state から計算できる値              | render 中に計算する                                                                         |
| ユーザー操作をきっかけにした処理           | イベントハンドラ                                                                            |
| 外部ストア・ブラウザ API の購読            | zustand などの状態管理ライブラリ（購読は store 側に書き、コンポーネントは selector で読む） |
| props が変わったときの state の初期化      | 親から `key` を渡す                                                                         |
| DOM の操作、React 外のウィジェットの初期化 | ref callback（React 19 から cleanup 関数を返せる）                                          |

```tsx
// Bad: 描画した後に取得し、結果を state に写す
const [user, setUser] = useState<User>();
useEffect(() => {
  fetchUser(id).then(setUser);
}, [id]);
if (!user) {
  return <Spinner />;
}

// Good: 取得とキャッシュを TanStack Query に任せる
const { data: user } = useSuspenseQuery({
  queryKey: ["user", id],
  queryFn: () => fetchUser(id),
});
```

```ts
// Good: ブラウザのイベントは store を作るモジュールで購読し、コンポーネントは selector で読む
const useOnlineStore = create(() => ({ online: navigator.onLine }));
window.addEventListener("online", () => useOnlineStore.setState({ online: true }));
window.addEventListener("offline", () => useOnlineStore.setState({ online: false }));

const online = useOnlineStore((state) => state.online);
```

なぜ: Effect は描画を終えた後に走る。データ取得なら「空で描画 → 取得 → 再描画」の往復と loading・競合状態の手書きを生み、値の同期なら state が二重になって余計な再描画が走る。目的ごとの仕組みに任せれば、いつ待ち、いつ更新するかを React とライブラリが管理する。

## 画面はすぐ描画し、データは Suspense 境界で待つ

描画の前に Promise を待つ処理（`createRoot().render()` 前の `await`、ページ全体を覆う loading 分岐）を置かない。表示に使うデータは TanStack Query の `useSuspenseQuery` で読み、待つ範囲をそのコンポーネントの直近の `<Suspense fallback>` で囲む。

```tsx
// Bad: 一部のデータのために、ページ全体を止める
function ProjectPage() {
  const { data: project, isPending } = useQuery(projectQuery);
  if (isPending) {
    return <FullPageSpinner />;
  }
  return (
    <main>
      <Header />
      <ProjectDetail project={project} />
    </main>
  );
}

// Good: 待たない部分は先に出し、待つ部分だけを fallback にする
function ProjectPage() {
  return (
    <main>
      <Header />
      <Suspense fallback={<ProjectDetailSkeleton />}>
        <ProjectDetail />
      </Suspense>
    </main>
  );
}

function ProjectDetail() {
  const { data: project } = useSuspenseQuery(projectQuery);
  return <h1>{project.name}</h1>;
}
```

- セッションの有無のように、否定されたときだけ画面を切り替える確認は待たない。`useQuery` で読んで先に描画し、否定が確定したら切り替える（楽観的な表示。認証ガードの例は tk-stack-tanstack-router を参照）
- 表示済みの内容を再び suspend させる更新（絞り込み、ページ送り）は `startTransition` で包む。transition 中は前の表示を残したまま次のデータを待ち、進行は `useTransition` の `isPending` で示せる

なぜ: 描画前の待ちは、待つ必要の無い部分まで画面ごと止め、利用者は空白かスピナーだけを見る。Suspense 境界を待つ部分の直近に置けば残りはすぐ表示・操作でき、どこが何を待つかが JSX の構造として読める。否定されることがまれな確認まで待てば、大半の利用者を無駄に待たせる。
