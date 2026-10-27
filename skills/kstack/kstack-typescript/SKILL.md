---
name: kstack-typescript
description: TypeScript コードを書く・修正する・レビューするときの規約。ts ファイルや TypeScript の関数・class を扱う場面すべてで使用すること — return 型アノテーションやそのためだけの interface・type を書かず導出に任せること、Promise.all・Promise の then を使わず async/await で逐次展開すること、else を使わない早期 return、if の前の空行、引数・this・env のプロパティを読むためだけに分割代入せず元のオブジェクトから参照すること（型の絞り込みのためでも同じ）、既に名前がある値を短縮のためだけに別名へ移さないこと、class でしか使わない関数を private method にすること、class・error・定数・型が同居するファイルをディレクトリに分けて index.ts から export することなど。コード生成、リファクタリング、ファイル分割、バグ修正、レビュー指摘への対応でも発火させる。
disable-model-invocation: false
---

# kstack-typescript

TypeScript コードを書くときの規約。理由を理解した上で適用すること。

## 導出できる型を手書きしない

関数の戻り値の型アノテーションも、それを書くためだけの `interface` / `type` も書かず、TypeScript の導出に任せる。

```ts
// Bad: 導出元と同じ形を interface に写し、戻り値に付けている
interface Content {
  title: string;
  body: string;
}
const load = (): Promise<Content> => fetchContent();

// Good: 導出に任せる
const load = () => fetchContent();
```

なぜ: 手書きの型は導出元と同じ情報を二重に持つだけで、内部実装の変更時に 2 箇所のメンテが必要になる。型の名前が要る呼び出し側は `Awaited<ReturnType<typeof load>>` のように導出元から取ればよい。

例外は TypeScript が戻り値を導出できない場合（自身の戻り値に依存する再帰関数など）だけ。公開 API・RPC・package の境界であることや、依存先の型から独立させたいことは書く理由にならない。境界でも導出した型がそのまま呼び出し側へ伝わる。

## Promise.all・Promise の then を使わず、async/await で逐次展開する

非同期処理は `Promise.all` や Promise の `.then()` で組まず、`async` 関数の中で 1 つずつ `await` して上から順に書く。独立した処理も同じ。失敗時の処理はその場に残し、後続処理へ進ませない。

```ts
// Bad: 非同期処理と後続処理をコールバックに詰めている
const load = () =>
  Promise.all([fetchProfile(), fetchSettings()]).then(([profile, settings]) =>
    buildPage({ profile, settings }),
  );

// Good: 処理を上から順に読める
const load = async () => {
  const profile = await fetchProfile();
  const settings = await fetchSettings();
  return buildPage({ profile, settings });
};
```

なぜ: コールバックのネストをなくし、処理順と失敗時にどこで抜けるかを上から追えるようにする。独立処理の並列実行による待ち時間の短縮より、この読みやすさを優先する。

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

## 制御フローのネストを 2 段までにする

関数内の制御フローは `max-depth` の `max: 2` に合わせ、3 段以上をガード句で浅くする。`if` だけでなく `for`・`while` などのループ、`switch`・`try` なども深さに数える。`if` 内の `if` とループ内の `if` はどちらも 2 段なので許可する。関数ごとに数え直すため、コールバック内の分岐は外側の深さに加算しない。

```ts
// Bad: 3 段に重ねて主処理を埋めている
function save(user) {
  if (user) {
    if (user.active) {
      if (user.verified) {
        return saveUser(user);
      }
    }
  }
}

// Good: ガード句で 2 段までに収める
function save(user) {
  if (!user) {
    return;
  }

  if (user.active) {
    if (user.verified) {
      return saveUser(user);
    }
  }
}
```

なぜ: 制御フローを重ねると、処理を読む間に保持する条件が増える。ガード句で不要な経路を先に終わらせると、主処理までの条件を上から追える。

## `if` の前には空行を置く

`if` 文の前には、直前の文（別の `if` ブロックを含む）との間に空行を 1 行入れる。ブロックの先頭（`{` の直後）の `if` だけは入れない。`if` にコメントを付けるときはコメントも `if` の一部とみなし、空行はコメントの前に置く。

```ts
// Bad: 値を用意する文と `if` が詰まっていて、判断の境界が読み取りにくい
async function update(args: { id: string; patch: Patch }) {
  if (!args.patch.name) {
    return Result.err("empty patch");
  }
  const user = await findUser(args.id);
  // 退会済みのユーザーは更新できない
  if (user.deletedAt) {
    return Result.err("deleted");
  }
  return save(merge(user, args.patch));
}

// Good: 先頭以外の `if` は前に空行を置く。コメントを付けるなら、空行はコメントの前
async function update(args: { id: string; patch: Patch }) {
  if (!args.patch.name) {
    return Result.err("empty patch");
  }
  const user = await findUser(args.id);

  // 退会済みのユーザーは更新できない
  if (user.deletedAt) {
    return Result.err("deleted");
  }
  return save(merge(user, args.patch));
}
```

なぜ: `if` は処理の行き先を変える境界。空行で区切ると、「値を用意する → 判定する → 続きを処理する」の段落が目で追え、分岐を探すときも空行を手がかりにできる。

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

## プロパティを読むだけの分割代入をしない

引数・`this`・`env` のように既に名前で参照できるオブジェクトは、`const { ... } = args.update` で変数に移さず、`args.update.userId` のように元のオブジェクトから読む。`if` での型の絞り込みも `this.session` のままでできる。関数呼び出しの戻り値を受けるときの分割代入（`const { data } = useQuery(...)`）は対象外。

短く書くためだけに、既に名前がある値を `a`・`i` などの別名へ移さず、元の名前で参照する。ループカウンターの `i` や SQL の self-join で役割を区別する別名は対象外。

```ts
// Bad: プロパティを読むためだけに、同じ値の別名を作っている
const open = (args: { update: Update }) => {
  const { userId, status, receivedAt } = args.update;
  return { userId, status, startedAt: receivedAt };
};

// Good: 元のオブジェクトから直接読む
const open = (args: { update: Update }) => ({
  userId: args.update.userId,
  status: args.update.status,
  startedAt: args.update.receivedAt,
});

// Bad: 絞り込むためだけに、this のプロパティを別名の変数に移している
public received(text: string) {
  const { session } = this;

  if (session === null) {
    return [];
  }
  return this.handle({ session, text });
}

// Good: this のプロパティを直接絞り込む
public received(text: string) {
  if (this.session === null) {
    return [];
  }
  return this.handle({ session: this.session, text });
}

// Bad: 既に名前がある値を短く書くためだけに別名へ移している
const i = categoryItems;
query.from(i);

// Good: 元の名前で参照する
query.from(categoryItems);
```

なぜ: 読むだけの分割代入や短縮別名は同じ値の名前を増やすだけで、読み手は出どころを宣言まで遡って確かめ、別名と元のどちらを読むべきかも追わされる。元の名前なら出どころがその場で読め、TypeScript は `this.session` のようなプロパティの参照も `if` で絞り込める。

## class でしか使わない関数は private method にする

1 つの class からしか呼ばない関数は、モジュール直下に置かず、その class の private method にする。`this` を使わない処理でも同じ。定数はモジュール直下に置いてよい。

```ts
// Bad: class でしか使わない関数がモジュール直下に浮いている
const buildUrl = (args: { base: string; version: number }) => `${args.base}?v=${args.version}`;

export class Client {
  public connect() {
    return buildUrl({ base: this.base, version: 10 });
  }
}

// Good: private method にする
export class Client {
  public connect() {
    return this.buildUrl({ base: this.base, version: 10 });
  }

  private buildUrl(args: { base: string; version: number }) {
    return `${args.base}?v=${args.version}`;
  }
}
```

なぜ: private method なら、誰がその処理を使うかをアクセス修飾子で読め、モジュール直下の関数のように他のファイルから import されて依存が広がることもない。`this` を使わないことは、class の外に置く理由にならない。

## class・error・定数・型が同居するファイルはディレクトリに分ける

1 つのファイルに class と error・定数・型が同居するなら、`<name>.ts` を `<name>/` ディレクトリに変え、種類ごとのファイル（`errors.ts`・`constants.ts`・`types.ts`・class の `<name>.ts`）に分ける。ディレクトリの外に出すものだけを `<name>/index.ts` から export する。関数と対応表だけのように、責務が 1 つで error も型も持たないファイルは分けない。

```text
// Bad: error・定数・型・class が 1 ファイルにあり、何を外に出すかは散らばった export から読むしかない
src/client.ts

// Good: 種類ごとに分け、外に出すものは index.ts に集める
src/client/
  index.ts       // export { Client } from "./client";
  client.ts
  errors.ts
  constants.ts
  types.ts
```

なぜ: 種類ごとにファイルがあれば、error や定数を探すときに class の実装を読み進めずに済む。index.ts を外への唯一の出口にすると、ディレクトリ内の型や定数が外から直接 import されず、何が公開されているかを 1 ファイルで読める。
