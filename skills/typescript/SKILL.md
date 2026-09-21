---
name: typescript
description: TypeScript コードを書く・修正する・レビューするときの規約。ts ファイルや TypeScript の関数を扱う場面すべてで使用すること — return 型アノテーションの省略、else を使わない早期 return など。コード生成、リファクタリング、バグ修正、レビュー指摘への対応でも発火させる。
disable-model-invocation: false
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

## else・三項演算子を使わない。早期 return する

分岐は `else` や三項演算子に閉じ込めず、ガード句として先に return する。

```ts
// Bad: 異常系と主処理が else・三項演算子の中に埋もれる
function save(user) {
  if (user) {
    return user.active ? saveUser(user) : Result.err("inactive");
  } else {
    return Result.err("no user");
  }
}

// Good: 異常系を先に終わらせ、主処理を最後に残す
function save(user) {
  if (!user) {
    return Result.err("no user");
  }
  if (!user.active) {
    return Result.err("inactive");
  }
  return saveUser(user);
}
```

なぜ: 早期 return は主処理のインデントを浅く保ち、「どの条件でどの処理になるか」を上から読めるようにする。`else` や三項演算子は条件と処理の対応を式やネストの中に埋めてしまう。

## 関数の引数はオブジェクトに構造化する

複数の引数を位置引数で受け取らず、単一のオブジェクト引数にまとめる。

```ts
// Bad: 位置引数は呼び出し側で意味が分からず、追加や並べ替えで黙って壊れる
private toMentions(answerId: string, text: string, limit: number) {}

// Good: 呼び出し側が各引数の名前で渡せる
private toMentions(args: { answerId: string; text: string; limit: number }) {}
```

なぜ: オブジェクト引数は呼び出し側の意図を名前で明示し、後から引数を追加・並べ替えても型エラーで保護される。位置引数は順序が変わっても黙って受け渡しがずれる。

## 条件付きオブジェクト spread を使わない

プロパティの有無を spread で切り替えず、引数を object union に分けて早期 return する。

```ts
type BuildArgs = { id: string } | { id: string; metadata: Metadata };

// Bad: どの形を返すかが spread の式に埋もれる
const build = (args: BuildArgs) => ({
  id: args.id,
  ...("metadata" in args ? { metadata: args.metadata } : {}),
});

// Good: 引数と戻り値の形を同じ分岐で明示する
const build = (args: BuildArgs) => {
  if (!("metadata" in args)) {
    return { id: args.id };
  }
  return { id: args.id, metadata: args.metadata };
};
```

なぜ: union と早期 return なら各入力に対応する出力が明示され、条件付き spread より型の分岐を追いやすい。

## 小さすぎる処理を関数化しない

1 箇所でしか使わない数行の処理に名前を付けず、呼び出し箇所にそのまま書く。

```ts
// Bad: 中身を追うために定義へジャンプさせられる
const toDisplayName = (user: User) => user.nickname ?? user.name;
// ...遠く離れて...
const label = toDisplayName(user);

// Good: その場で読み切れる
const label = user.nickname ?? user.name;
```

なぜ: 関数化は重複を減らすための道具で、1 回しか使わない処理に名前を付けると読み手は定義へのジャンプを強いられる。同じ処理が 2 箇所以上ある場合だけ切り出す。

## 各メソッドで繰り返す依存の生成は constructor に置く

class の複数メソッドで同じ依存オブジェクトを作るなら、モジュール直下のヘルパー関数を作らず constructor で一度だけ作る。

```ts
// Bad: ヘルパーを各メソッドで呼び、同じオブジェクトを作り直している
const repositoryOf = (env: Env) => new Repository({ db: createClient(env) });

class Api {
  public async add() {
    const repository = await repositoryOf(this.env);
    // ...
  }
  public async list() {
    const repository = await repositoryOf(this.env);
    // ...
  }
}

// Good: 生成は constructor に 1 箇所
class Api {
  private readonly repository: Repository;

  constructor(env: Env) {
    this.repository = new Repository({ db: createClient(env) });
  }

  public async add() {
    this.repository.add(/* ... */);
  }
}
```

なぜ: constructor で作れば生成と依存関係が class の先頭に集まり、各メソッドは使うことに集中できる。メソッドごとの呼び出しヘルパーは重複を生み、そのヘルパーの存在理由を読み手に考えさせる。
