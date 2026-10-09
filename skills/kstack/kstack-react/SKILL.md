---
name: kstack-react
description: React のコンポーネント・hooks を書く・修正する・レビューするときの規約。useEffect・useLayoutEffect を使わず、データ取得は TanStack Query（useSuspenseQuery）と Suspense、外部の状態の購読は zustand などの store に任せ、描画を止めない非同期・楽観的な UI を設計する。view を index.tsx・hooks/・components/ のディレクトリにまとめて .tsx には関数を 1 つだけ置くこと、view と hook を 1 対 1 にして hook が表示の形で返すこと、フォームをデータが揃ってから key 付きの内側の component で mount することも扱う。tsx でのデータ取得、ローディング表示、派生 state、ブラウザ API や外部ストアの購読、認証確認などの楽観的な表示、絞り込み・ページ送りなど再取得を伴う更新、コンポーネントの分割・ファイル配置・hook の切り出し、フォーム（TanStack Form など）の初期値、レビュー指摘への対応でも発火させる。
---

# kstack-react

[React](https://react.dev/) のコンポーネントを書くときの規約。理由を理解した上で適用すること。ルーターの `beforeLoad`・`loader` の書き方は kstack-tanstack-router、URL に載せる state は kstack-nuqs、live query は kstack-tanstack-db の SKILL を参照。

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

// 別のファイルに置く（.tsx には関数を 1 つだけ置く）。useProjectDetail は useSuspenseQuery(projectQuery) で読む
function ProjectDetail() {
  const { project } = useProjectDetail();
  return <h1>{project.name}</h1>;
}
```

- セッションの有無のように、否定されたときだけ画面を切り替える確認は待たない。`useQuery` で読んで先に描画し、否定が確定したら切り替える（楽観的な表示。認証ガードの例は kstack-tanstack-router を参照）
- 表示済みの内容を再び suspend させる更新（絞り込み、ページ送り）は `startTransition` で包む。transition 中は前の表示を残したまま次のデータを待ち、進行は `useTransition` の `isPending` で示せる

なぜ: 描画前の待ちは、待つ必要の無い部分まで画面ごと止め、利用者は空白かスピナーだけを見る。Suspense 境界を待つ部分の直近に置けば残りはすぐ表示・操作でき、どこが何を待つかが JSX の構造として読める。否定されることがまれな確認まで待てば、大半の利用者を無駄に待たせる。

## view は 1 ディレクトリにまとめ、`.tsx` のトップレベルには関数を 1 つだけ置く

画面を構成する view は、名前を付けたディレクトリに置く。本体を `index.tsx`、その view 専用の hook と非 JSX の純関数を `hooks/`、その view の内側でしか使わない部品を `components/` に置き、これ以外のファイルを `index.tsx` の隣に並べない。`.tsx` のトップレベルに置く関数（コンポーネント）は 1 つまでにし、補助のコンポーネントや関数は別ファイルへ出す（関数でない定数や型は置いてよい）。

```text
# Bad: 1 ファイルに関数が同居し、内側の部品が index.tsx の隣に平置きされている
dashboard/
  order-summary/
    index.tsx        # OrderSummary・OrderRow・formatPrice を定義
    order-row.tsx

# Good: 1 ファイル 1 関数。view の中身は hooks/ と components/ に分ける
dashboard/
  components/        # 画面内の複数の view が共有する部品
  hooks/             # 画面内の複数の view が共有する .ts
  order-summary/
    index.tsx        # OrderSummary だけ
    hooks/
      use-order-summary.ts
    components/
      order-row.tsx  # この view の中でしか使わない
```

- `components/` は、それを持つディレクトリの外から import しない。別の view や画面からも使うなら、共有の置き場所（`src/components/` など）へ移す。共有する前提で作る部品は、使う場所が 1 つでも最初から共有の置き場所に置いてよい
- `src/` やページ・レイアウトの境界をまたぐ import は alias（`@/…`）で書き、`../../` の相対パスで越えない
- page（route のファイル）が直接描画する view は、状態表示だけでも view のディレクトリにする。画面の `components/` はその画面の外から import できず、page は画面のディレクトリの外にいる

なぜ: 1 ファイル 1 コンポーネントなら責務が混ざらず、置き場所が構造から決まる。`components/` を外から import させなければ、view どうしが部品を介して暗黙に結びつかず、共有が要った時点で「共有の置き場所へ移す」という判断が必ず挟まる。

## view と hook は 1 対 1 にし、hook が表示の形で返す

view ごとに `hooks/use-<view>.ts` を 1 つ置く。データの読み取り、集計・整形、表示の判定（`showEmpty`、データ源が suspend しないときの `isLoading`）は hook の中で終わらせ、component は戻り値を描くだけにする。集計・整形のための関数や型は、その hook のファイルに非 export で置き、共有モジュールへ切り出さない。複数の view が同じ式を使っていても、それぞれの hook に書く。自分ではデータを読まず、親や page が確定させた値を props で受けて描くだけの view（状態表示など）は hook を持たない。

```tsx
// Bad: component が集計と判定を持ち、式は共有モジュールから import している
import { totalOf } from "@/lib/order-metrics";

function OrderSummary() {
  const { data: orders } = useSuspenseQuery(ordersQuery);
  if (orders.length === 0) {
    return <Empty />;
  }
  return <Total value={totalOf(orders)} />;
}

// Good: hook が表示の形で返し、component は描くだけ
function OrderSummary() {
  const { total, showEmpty } = useOrderSummary();
  if (showEmpty) {
    return <Empty />;
  }
  return <Total value={total} />;
}
```

- 共有してよいのは、view ごとにずれると表示や動作が食い違うもの（集計期間の丸め、系列への色の割り当て、エラー文言の表、値の形の変換など）と、テストが要るドメインロジックだけ。重複を減らす目的では切り出さない
- クエリの結果の型は導出に任せる。表示部品の props は、項目が 2〜3 個なら受け取る側のファイルに直接書く。hook と表示部品の間で型だけのファイルを共有しない（hook が export した行の型を表示部品が `import type` するのは可）
- 見た目の判断（増減の符号から色クラスを決める、など）は表示部品に置く。hook は値だけを返す
- hook は引数なしで呼べる形にし、選択中の項目や URL の state は hook の中で解決する。例外は、hook の中では決められない値、または引き直すと食い違いうる値。親が読み込み済みの行を受け取るフォームの hook、route の param（hook の中でルートを引くと hook がその route に癒着する）、親が確定させた id に書き込むだけの hook、購読する対象や登録するフォームのように呼び出し側が決める値は引数で受ける

なぜ: UI は頻繁に変わるので、重複を許してでも、変更が他の view へ波及しないほうが安い。式を共有すると片方の変更が他方に及び、component が集計を持つと見た目の変更と計算の変更が同じファイルで絡む。hook が表示の形で返せば、component は何を描くかだけを読める。

## フォームはデータが揃ってから、key 付きの内側の component で mount する

既存の行を編集するフォームは 2 段に分ける。外側の component（view の `index.tsx`）がデータを読み、揃ってから内側のフォーム component を `key` 付きで mount する。`useForm` と保存の mutation は内側の hook（`hooks/use-<name>-form.ts`）が持つ。`key` は外側の hook が組み立て、「作り直すべき変化」を写した文字列にする（行を更新するなら `id:updatedAt`、版が増えるだけの行なら `id:version`）。読む行が無い作成フォームは 1 段でよい。データ源が suspend しないなら、hook が返す `isLoading` が false になるまで内側を mount しない。

```tsx
// Bad: 空の初期値で先に mount し、データが届いたら effect で reset する
function ShippingCard() {
  const { data } = useQuery(shippingQuery);
  const form = useForm({ defaultValues: { address: data?.address ?? "" } });
  useEffect(() => form.reset({ address: data?.address ?? "" }), [data]);
  return <ShippingFields form={form} />;
}

// Good: 外側が読み、揃ってから内側を mount する。作り直しは key に任せる
function ShippingCard() {
  const { shipping, formKey } = useShippingCard();
  return <ShippingForm key={formKey} shipping={shipping} />;
}
```

なぜ: `defaultValues` は reactive でないので、データが届く前に mount すると空の初期値で始まり、届いた後に effect で `reset` すると入力中の値まで上書きする。揃ってから mount し、保存後の再取得や別の行への切り替えを `key` で作り直せば、初期値を同期する処理がそもそも要らない（最初の表の「props が変わったときの state の初期化」と同じ考え方）。
