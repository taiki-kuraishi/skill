---
name: typescript
description: TypeScript コードを書く・修正する・レビューするときの規約。ts ファイルや TypeScript の関数を扱う場面すべてで使用すること — return 型アノテーションの省略、else を使わない早期 return など。コード生成、リファクタリング、バグ修正、レビュー指摘への対応でも発火させる。
---

# typescript

TypeScript コードを書くときの規約。理由を理解した上で適用すること。

## 関数の戻り値の型アノテーションは書かない

戻り値の型は TypeScript が導出するため、手書きしない。

```ts
// Bad: 導出できるものを手書きしている
const load = (): Promise<Content> => fetchContent();

// Good: 導出に任せる
const load = () => fetchContent();
```

なぜ: アノテーションを書くと内部実装の変更時に 2 箇所のメンテが必要になる。導出で済む情報の手書きはノイズでしかない。

例外はほぼ無い。意図的に型を絞り込んで公開 API の契約を固定したい場合だけ検討し、書く前に「導出で足りないか」を自問すること。

## else を使わない。早期 return する

分岐は else ブランチでネストさせず、ガード句として先に return する。

```ts
// Bad
function save(user) {
  if (user) {
    // 主処理...
  } else {
    return Result.err("no user");
  }
}

// Good
function save(user) {
  if (!user) {
    return Result.err("no user");
  }
  // 主処理...
}
```

なぜ: 早期 return は主処理のインデントを浅く保ち、「どの条件でどの処理になるか」を上から読めるようにする。else は条件と処理の対応をネストの中に埋めてしまう。
