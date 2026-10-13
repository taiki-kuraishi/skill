# @taiki-kuraishi/oxlint-config

SKILL の規約を表す oxlint の共有設定と、自作ルールの JS plugin。

## 責務

- 実装すること: kstack の SKILL ごとの oxlint 共有設定（`extends` に渡す設定オブジェクト）と、既存ルールで表せない規約の自作ルール（JS plugin）
- 実装しないこと: oxfmt の設定、SKILL に書かれていない規約、型情報を使うルール（oxlint の JS plugin は型情報を使えない）

## SKILL と設定の対応

export する設定は SKILL の名前から `kstack-` を除いた名前にする（`kstack-tanstack-query` → `tanstackQuery`）。既存ルールで表せない規約は、`src/rules/` に自作ルールを置き、plugin `kstack`（`@taiki-kuraishi/oxlint-config/plugin`）から export する。表せない規約は、lint で守れないのでレビューで確かめる。

### kstack-typescript（`typescript`）

| 規約                                                | ルール / 表せない理由                                                                                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 導出できる型を手書きしない                          | `kstack/no-explicit-return-type`。type predicate・`asserts` は除く。導出できない再帰関数は disable コメントで理由を残す。戻り値のためだけの `interface` / `type` は検出しない |
| else・三項演算子を使わない。早期 return する        | `kstack/no-else`、`no-ternary`                                                                                                                                                |
| `if` の前には空行を置く                             | `kstack/blank-line-before-if`                                                                                                                                                 |
| 関数の引数はオブジェクトに構造化する                | `kstack/object-params`。呼び出しの引数にその場で書く関数（コールバック）と `this` 引数は除く。名前を付けて参照で渡すコールバックは検出するので、disable コメントで理由を残す  |
| 条件付きオブジェクト spread を使わない              | `kstack/no-conditional-spread`                                                                                                                                                |
| 小さすぎる処理を関数化しない                        | 表せない。「小さい」「名前に意味がある」を構文から決められない                                                                                                                |
| 各メソッドで繰り返す依存の生成は constructor に置く | 表せない。依存の生成と同じ関数の呼び出しを構文から区別できない                                                                                                                |

### kstack-layerd-architecture（`layerdArchitecture`）

「use case の処理は step 番号付きの doc と step コメントで書く」で入った規約だけを載せる。`kstack/use-case-steps` は、class 名が `UseCase` で終わり、本体を持つ `execute` を持つ class だけを見る。

| 規約                                                                      | ルール / 表せない理由                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `execute` の doc comment に、要約の 1 行と番号付きの step を並べる        | `kstack/use-case-steps`（messageId `missingDoc`・`missingSteps`・`missingSummary`）。doc comment が無い、`1. ...` の行が無い、番号付き step の前に要約行が無い形を指す。class 名が `UseCase` で終わらない use case、宣言だけの `execute` は検出しない        |
| 本文の各 step の先頭に、doc と同じ番号・同じ文言で `// stepN: ...` を書く | `kstack/use-case-steps`（messageId `mismatch`・`missingBodyStep`）。doc に無い番号の step コメント、文言の違う step コメント、本文に無い doc の step を指す。文言は trim 後の完全一致で見る。`// step 1:` のように空白を入れた形と、番号の順序・連番は見ない |
| step の間を空行で区切る                                                   | `kstack/use-case-steps`（messageId `missingBlankLine`）。2 つ目以降の step コメントの直前の行が空行でない形を指す。1 つ目の step は本体の先頭に来るので要求しない                                                                                            |

### kstack-react（`react`）

`useQuery` を既定にする変更（`useSuspenseQuery` をやめる）で入った規約だけを載せる。

| 規約                                                                                                      | ルール / 表せない理由                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSuspenseQuery` を使わず、`useQuery` で読む                                                            | `no-restricted-imports`。`@tanstack/react-query` の `useSuspenseQuery`・`useSuspenseQueries`・`useSuspenseInfiniteQuery` の import を禁止する                                                                                                                                                                                                                                                                                       |
| データを待つための `<Suspense fallback>` を使わない                                                       | 表せない。`React.lazy` のコード分割でも `<Suspense>` を使うので、`react` の `Suspense` を import 禁止にすると `lazy` の形を誤検知する（実際に指摘が出ることを確認した）。データ待ちとコード分割は構文から区別できない                                                                                                                                                                                                               |
| component では `data` / `isPending` を見ず、読み込み中の判定は view の hook が行う                        | `kstack/no-query-in-component`。JSX を返す関数（component）が query hook の結果を分割代入し、読み込み中の flag（`isPending`・`isLoading`・`isFetching`・`isRefetching`）を見る、`data === undefined` を判定する、`data?.name` のように `data` の中身を読む形を指す。`data === null` の確認だけの形（セッションの有無を見る gate。kstack-tanstack-router の例）と、分割代入せず `const query = useQuery(...)` で受ける形は検出しない |
| view と hook は 1 対 1 にし、hook が表示の形（`status` など）で返す                                       | `kstack/no-query-in-component`（上と同じ形を指す）。戻り値に `status` を使うかは構文から決められない                                                                                                                                                                                                                                                                                                                                |
| hook は `error` を分岐しない                                                                              | `kstack/no-query-error`。`Query` / `Queries` で終わる hook の呼び出し（package の hook も view の hook も見る）から `error`・`isError`・`failureReason` を分割代入する形を指す。`query.error` のようなメンバー経由と、名前に `Query` を含まない hook は検出しない                                                                                                                                                                   |
| 見つからない判定は `data === null` で書き、`!data` で書かない                                             | `kstack/no-negated-data`。`data` という名前、または query hook の分割代入で `data` から束縛した名前の `!` を指す。`Boolean(data)`・`data == null`・`data?.name` は検出しない                                                                                                                                                                                                                                                        |
| フォームは外側の hook が `data === undefined` の間 loading を返し、外側の component は内側を mount しない | `kstack/no-query-in-component`。データが揃う前に内側を mount する外側の component が `data?.address` のように `data` を読む形を指す（SKILL の Bad 例）                                                                                                                                                                                                                                                                              |
| 前の表示を残すのは `placeholderData: keepPreviousData`                                                    | 表せない。query key が変わる更新かどうかを構文から決められない（`placeholderData` が無いことが誤りとは限らない）                                                                                                                                                                                                                                                                                                                    |

### kstack-tanstack-query（`tanstackQuery`）

| 規約                                                                                                             | ルール / 表せない理由                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| package の query hook は `useQuery` の結果をそのまま返す                                                         | `kstack/no-use-query-destructure`。名前が `Query` / `Queries` で終わる hook（`useTodosQuery` など package の query hook）が `useQuery`・`useQueries`・`useInfiniteQuery` の結果を分割代入する形を指す。view の hook が `const { data } = useQuery(projectQuery)` と読む形（kstack-react の例）は、package か app かを構文から区別できないので指摘しない。分割代入せず `const query = useQuery(...)` で受ける形は検出しない |
| query の options（`placeholderData` など）は `options` で受けて展開する                                          | `kstack/no-unspread-options`。引数 `options` を持つ関数の `useQuery`・`useQueries`・`useInfiniteQuery`・`useMutation` 呼び出しで、そのオブジェクト引数に `...options` が無い形を指す。`...(options ?? {})` は検出しない                                                                                                                                                                                                    |
| queryFn は undefined を返さず、見つからないことは `null` を返す                                                  | 表せない。queryFn が undefined で解決するかは構文から決まらない（`fetch` の結果をそのまま返す、参照した関数の中など）。`unicorn/no-useless-undefined` は `return undefined` を指せるが、TanStack の `getNextPageParam: () => undefined` のような規約と無関係な形も指すので有効にしない（実際に指摘が出ることを確認した）                                                                                                   |
| data が無いまま失敗した query は QueryClient の既定で Error Boundary に投げる（`throwOnError: true` は使わない） | `kstack/throw-on-error-placement`（messageId `literal`）。query の options（`defaultOptions.queries` と `useQuery` 系・`queryOptions`・`infiniteQueryOptions` の引数）だけを見る。mutation と無関係な同名の property は検出しない                                                                                                                                                                                          |
| package・app の hook に `throwOnError` を書かない                                                                | `kstack/throw-on-error-placement`（messageId `inHook`）。query の options（`defaultOptions.queries` と `useQuery` 系・`queryOptions`・`infiniteQueryOptions` の引数）だけを見る。mutation と無関係な同名の property は検出しない                                                                                                                                                                                           |

### kstack-tanstack-router

loader の結果をコンポーネントの hook が `useQuery` で読む、という文言の変更だけで、新しい規約は無い。設定は作らない（`useSuspenseQuery` を使わないことは `react` の `no-restricted-imports` が見る）。

### kstack-monorepo

「root README は見出しと概要だけにする」で入った規約だけを載せる。

| 規約                                                                                            | ルール / 表せない理由                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root README は見出しと概要だけにし、構成表・セットアップ・テスト手順は package の README に置く | 表せない。Markdown は oxlint の lint 対象外（`oxlint README.md` は `No files found to lint` になる）。oxfmt は整形だけを扱い、root の README に何を書くかは構文から決まらない |

### kstack-gdscript

5 規約すべてを載せる。oxlint は `.gd` を lint せず（`oxlint src/player.gd` は `No files found to lint` になる）、oxfmt も `.gd` を整形しない（`oxfmt --check src/player.gd` は `Expected at least one target file` になる）。

| 規約                                                                 | ルール / 表せない理由                                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 宣言すべてに日本語の `##` doc comment を書く                         | 表せない。oxlint / oxfmt は `.gd` を扱わない                                                                               |
| 型アノテーションを明示し、`:=` で推論させない                        | 表せない。同上                                                                                                             |
| 型チェックは project.godot の warning を error にして強制する        | 表せない。SKILL 自身が Godot 側（`project.godot` の `gdscript/warnings/*`）の設定で強制する。oxlint / oxfmt の設定ではない |
| 複数の段を持つ関数は step 番号付きの doc と `# stepN` コメントで書く | 表せない。同上（GDScript 版の `kstack/use-case-steps` は書けない）                                                         |
| GdUnit4 のテスト関数の上に、テスト内容を日本語で書く                 | 表せない。同上                                                                                                             |

### kstack-code-comment

例外の列挙（use case の step 番号付き doc、GDScript の宣言の `##` doc comment）を広げただけで、新しい規約は無い。設定は作らない。
