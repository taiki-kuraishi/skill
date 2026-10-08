---
name: tk-stack-nuqs
description: nuqs で URL のクエリ文字列を state として扱う React コードを書く・修正する・レビューするときの規約。URL に載せる state（選択中の項目、フィルタ、タブ、期間）と載せない state（zustand、useState）の振り分け、useQueryStates に渡す parser（parseAsString、parseAsStringLiteral、withDefault など）の定義の置き場所、useQueryStates を包む独自 hook の可否を扱う。検索・絞り込み・タブ・ページ送りを URL に持たせる実装、共有できるリンクの設計、フィルタ state の置き場所に迷う場面、レビュー指摘への対応でも発火させる。
---

# tk-stack-nuqs

[nuqs](https://nuqs.dev/) で URL の state を書くときの規約。理由を理解した上で適用すること。コンポーネントの構成は tk-stack-react、`NuqsAdapter` を TanStack Router に繋ぐ位置は tk-stack-tanstack-router の SKILL を参照。

## URL を共有して同じ表示になる state は URL に持つ

state は、URL を共有したときに同じ表示を再現したいかどうかで置き場所を分ける。

| state                                                                    | 置き場所             |
| ------------------------------------------------------------------------ | -------------------- |
| URL を共有すれば同じ表示になるもの（選択中の項目、フィルタ、タブ、期間） | URL のクエリ（nuqs） |
| URL に含めない、画面をまたぐもの                                         | zustand などの store |
| 1 つの component で閉じるもの（複数同時に開ける行の開閉など）            | `useState`           |

```tsx
// Bad: 共有したいフィルタを store に持っている。リンクを共有してもリロードしても失われる
const useFilterStore = create(() => ({ category: "all", sort: "new" }));

// Good: URL のクエリに持つ
const [{ category, sort }, setFilter] = useQueryStates(filterParsers);
```

なぜ: URL に載せた state は、リンクの共有・リロード・戻るボタンのどれでも同じ表示が再現される。store や `useState` のフィルタはそのたびに失われる。一方、行の開閉のように同時に開く数が増えうる一時的な状態まで URL に積むと、URL が長く汚れる。

## parser は page の隣の 1 ファイルに集める

parser の定義は page ごとに 1 ファイルへ集め、page の隣に置く。複数の page や component から使う parser も、定義を分散させず 1 ファイルにまとめて import する。ファイルベースのルーターでは、route 生成から除外される名前にする（TanStack Router なら `-params.ts`）。

```text
# Bad: 同じキーの parser を、使う component ごとに定義している
products/
  index.tsx                # category の parser を定義
  -filter-bar/index.tsx    # category の parser をもう一度定義

# Good: page の隣の 1 ファイルで定義し、使う側は import する
products/
  index.tsx
  -params.ts               # export const filterParsers = { category, sort }
  -filter-bar/index.tsx
```

なぜ: 同じキーの parser が複数あると、既定値や型がずれても、URL の読み書きが食い違うまで気づけない。1 ファイルなら、その page の URL がどのキーと既定値を持つかを 1 か所で読める。

## useQueryStates を包む hook を作らない

`useQueryStates` は、使う側（page・component・view の hook）が parser を渡して直接呼ぶ。parser を渡すだけの hook を挟まない。

```tsx
// Bad: parser を渡すだけの hook。呼び出し側は定義を 1 段たどらされる
export const useFilter = () => useQueryStates(filterParsers);

// Good: 呼び出し側が parser を渡して直接呼ぶ
const [{ category, sort }, setFilter] = useQueryStates(filterParsers);
```

例外は、URL と他の状態の照合（URL の値が動的な選択肢に無いときの補完など）、履歴（push と replace）の方針、連動するキーのリセットのように、振る舞いを 1 か所に集約する hook。URL の読み書き以上の仕事があるときだけ、hook にする価値がある。

なぜ: 何も足さない wrapper は、parser の定義と `useQueryStates` を読めば済む箇所に定義へのジャンプを 1 つ増やすだけで、振る舞いを持つ hook と見分けが付かなくなる。
