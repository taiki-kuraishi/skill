---
name: layerd-architecture
description: レイヤードアーキテクチャ（client / repository / use case / service / utils・libs）で TypeScript の class やファイルを書く・修正する・レビューするときの規約。各層の責務と置き場所の判断、層のファイルを class で書きモジュール直下に独立した関数を置かないこと（class 専用の処理は private method、共有処理は utils・libs へ移す）、外部 API・SDK を呼ぶ client の設計（API key・timeout の隠蔽、エラーの値化、レスポンスの parse、endpoint と method の 1 対 1）、DB の repository の設計（1 table 1 repository、join 時の命名、transaction を持たない、1 query 1 method）、use case の execute への集約と Result.gen による合成、Cloudflare Workflow の step と use case の対応、service・utils・libs を作ってよい条件を扱う。client・repository・usecase・steps・service・utils・libs の新規作成やメソッド追加、ヘルパー関数の置き場所に迷う場面、レビュー指摘への対応では必ず使用すること。
---

# layerd-architecture

use case が client / repository を呼ぶ一方向の構成。処理はまず下表のどれかに置き、どこにも属さないものだけを service にする。

| 層           | 置き場所                 | 責務                                                       |
| ------------ | ------------------------ | ---------------------------------------------------------- |
| client       | `src/client`             | 外部サービスへのリクエスト                                 |
| repository   | `src/repository`         | DB への永続化                                              |
| use case     | `src/steps` など         | client / repository の呼び出しと結果の合成                 |
| service      | `src/service`            | 上の 3 層に属さない処理。作る前に user の承認を取る        |
| utils / libs | `src/utils` / `src/libs` | 複数ファイルで使う stateless な関数 / ライブラリ設定・定数 |

## 層のファイルは class で書き、モジュール直下に関数を置かない

client / repository / use case のファイルには class だけを書く。その class でしか使わない処理は private method にし、複数ファイルで使う stateless な処理は utils / libs に移す。use case は private method を持たないので、後述の通り client / repository へ寄せる。

```ts
// Bad: どの class にも属さない関数がファイルに浮いている
const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
const toPrompt = (answer: Answer) => `...${normalizeWhitespace(answer.text)}`;

export class JudgeClient {
  public judge = (answer: Answer) => this.createResponse({ input: toPrompt(answer) });
}

// Good: class 専用の処理は private method、汎用の処理は utils から import する
import { normalizeWhitespace } from "../utils/string";

export class JudgeClient {
  public judge = (answer: Answer) => this.createResponse({ input: this.toPrompt(answer) });
  private toPrompt = (answer: Answer) => `...${normalizeWhitespace(answer.text)}`;
}
```

なぜ: class に収めればファイルの責務は public / private method がすべてになり、誰が使う処理かをアクセス修飾子で読める。浮いた関数は所属が曖昧で、他のファイルから import されると層の境界を越えた依存になる。

## client は外部サービスとの境界を閉じる

API key・認証情報・timeout は constructor で受け取ってリクエストに事前にセットし、公開 method の引数にしない。公開 method は endpoint（SDK があればその関数）と 1 対 1 にし、例外は better-result で値に変えて返す。SDK が無いならレスポンスを parse して型を付ける。

```ts
// Bad: use case が API key を渡し、1 method で 2 endpoint を叩き、throw して untyped な値を返す
public judge = async (args: { apiKey: string; prompt: string }) => {
  await fetch(`${BASE}/moderations`, { headers: { authorization: args.apiKey } });
  const res = await fetch(`${BASE}/responses`, { headers: { authorization: args.apiKey } });
  if (!res.ok) throw new Error("failed");
  return res.json();
};

// Good: 認証と timeout は client が持ち、POST /responses だけを型付きの Result で返す
constructor(private readonly config: { apiKey: string; timeoutMs: number }) {}

public createResponse = (body: CreateResponseBody) =>
  Result.gen(async function* () {
    const res = yield* await Result.tryPromise({
      try: () => fetch(`${BASE}/responses`, { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${this.config.apiKey}` }, signal: AbortSignal.timeout(this.config.timeoutMs) }),
      catch: (cause) => new ApiRequestError({ cause }),
    });
    const json = yield* await Result.tryPromise({ try: () => res.json(), catch: (cause) => new ApiResponseError({ cause }) });
    return Result.try({ try: () => ResponseSchema.parse(json), catch: (cause) => new ApiResponseError({ cause }) });
  }, this);
```

なぜ: 認証情報や timeout は業務の判断ではないので、use case に漏れると呼び出し側すべてが秘密値を扱うことになる。endpoint と 1 対 1 なら「どの API を何回叩くか」が use case に現れ、client はテストで endpoint 単位に差し替えられる。

## repository は 1 table 1 class、1 query 1 method

- join する repository は `<from の table><join 先の table>Repository` と名付ける（`user` inner join `payment` → `UserPaymentRepository`）
- transaction を張らない。張るのは use case
- DB の例外は client と同じく better-result で値に変える

```ts
// Bad: 複数 table への書き込みと transaction を repository が抱える
class UserRepository {
  public register = (args) => db.transaction(async (tx) => { /* insert user, insert payment */ });
}

// Good: 1 query を 1 method にし、transaction の境界は use case が決める
class UserRepository {
  public insert = (args: { tx: Tx; user: NewUser }) =>
    Result.tryPromise({ try: () => args.tx.insert(users).values(args.user), catch: (cause) => new DbQueryError({ cause }) });
}
```

なぜ: どこまでを原子的にするかは業務の要件で、repository が決めると別の use case で組み合わせられなくなる。1 query 1 method なら method 名から発行される SQL が分かる。

## use case は execute だけを持ち、分岐と呼び出しだけを書く

公開 method は `execute` 1 つ。中身は `if` / `for` による client・repository の呼び出しと `Result.gen` での合成だけにする。private method や計算処理が欲しくなったら、それは client / repository の method か別の use case に移す。業務上の 1 ユースケースに 1 class、Cloudflare Workflow では 1 step に 1 use case を対応させる。

```ts
// Bad: 外部呼び出しを private method に抱え、複数の操作を 1 class に詰める
class LaunchMirrorUseCase {
  public execute = (args: { cron: string }) => { /* ... */ };
  private isPending = (instanceId: string) => { /* this.env.WORKFLOW.get(...) */ };
}

// Good: 外部呼び出しは client の method にし、use case は流れだけを書く
class LaunchMirrorUseCase {
  constructor(private readonly deps: { workflow: WorkflowClient; mirrors: MirrorRepository }) {}

  public execute = (args: { cron: string }) =>
    Result.gen(async function* () { /* yield* await this.deps.workflow.get(...) ... */ }, this);
}
```

なぜ: use case は「1 つの操作」の入口で、読めば業務の手順が分かる状態に保ちたい。I/O を client / repository に寄せれば use case は依存を差し替えるだけでテストでき、Workflow の step とも 1 対 1 で retry の単位が揃う。

## service・utils・libs は最後の手段

- service は上の 3 層のどこにも属さない処理だけ。置き場所に迷って service にしがちなので、作る前に user の承認を取る
- utils は複数ファイルで使う stateless でビジネスロジックを持たない関数だけ。1 箇所でしか使わないならその場に書く
- libs はライブラリの設定と定数だけ

なぜ: 受け皿の層は何でも入るため、責務の曖昧な処理が溜まって層の境界が崩れる。作成に条件を付けることで、まず client / repository / use case への配置を検討させる。
