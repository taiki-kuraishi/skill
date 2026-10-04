---
name: tk-stack-interface-first-development
description: root session がファイル構成・API・UI・呼び出しの木・全関数の signature だけを設計書に定義し、フェーズごとの実装を user が開く別 session に引き継ぐ開発フロー
disable-model-invocation: true
---

# tk-stack-interface-first-development

複数フェーズに分かれる大規模な実装で、root session はインターフェースだけを設計書に定義し、実装を user が開く別 session（子）に引き継ぐ。root はコードを書かず、関数の中身や DB のクエリも考えない。その分を、子が設計書だけを読んで迷わず作れること、並列に進む子どうしがつなぎ目で食い違わないことに使う。設計書は root と子の契約で、書き換えるのは root だけにする。

## 手順

1. **要件を固める** — 依頼と既存コードを読み、作る画面・endpoint・扱うデータ、使える既存の関数、ファイル配置の規約をつかむ。調査が広ければ subagent に任せ、root の context は設計に残す。設計が分かれる要件は user に聞き、小さな判断は仮置きして設計書の「未決事項」に書く。完了条件: 画面・endpoint・データの一覧と対象外が決まっている
2. **設計書を書く** — 下の「設計書」の節を順に書き、repo に保存する（置き場所の規約が無ければ `docs/design/<機能名>.md`）。完了条件: 次の整合チェックをすべて満たす
   - 画面表示・フォーム送信・cron などの操作ごとに、呼び出しの木がある
   - 呼び出しの木のノードがすべて API・関数の節（既存を含む）にあり、関数の節のすべての関数がどれかの木に現れる
   - ディレクトリ構成のファイルと、型・関数の節の見出しのファイルが一致する
   - すべてのファイルがちょうど 1 つのフェーズに属し、呼ぶ側のフェーズが呼ばれる側のフェーズより先に始まらない
3. **レビューを受ける** — 設計書の path と、画面・endpoint・フェーズの要約を示して止まる。指摘は設計書に反映し、user が承認するまで繰り返す
4. **引き継ぐ** — フェーズごとに引き継ぎ prompt を出し、並列に始めてよいフェーズの組と順序（例: `1 → 2 と 3 を並列 → 4`）を添える。root の作業はここで終わる

## 設計書

冒頭に機能名・目的・対象外・未決事項を書き、続けて下の節を順に並べる。例は「プロジェクトへのメンバー招待」。

### ディレクトリ構成

作成・変更するファイルを tree で書き、ファイルごとに新規 / 変更と役割を 1 行添える。

```text
src/
├── shared/invitation.ts              新規  招待の型
├── api/routes/index.ts               変更  招待 API の route を登録する
├── api/routes/invitations.ts         新規  招待 API の route
├── api/usecase/create-invitation.ts  新規  招待を保存してメールを送る
├── api/repository/invitation.ts      新規  invitations table の読み書き
├── web/components/InviteForm.tsx     新規  招待フォームの表示
└── web/routes/members.tsx            変更  招待フォームを API につなぐ
```

なぜ: 置き場所を子に任せると、session ごとに別の場所・名前で作られる。フェーズの担当もファイル単位で決めるので、この tree が分担の単位になる。

### データの流れ

操作（画面表示、フォーム送信、cron など）ごとに、起点から呼び出しの木で書く。親が子を呼び（component なら描画し）、兄弟は呼ぶ順に並べる。ノードには API・関数の節にある endpoint と関数（既存を含む）だけを置き、読み書きする table を添える。

```text
Bad: 呼ぶ関係と順番が 1 列に潰れ、クエリまで書いている
InviteForm → POST /api/projects/:projectId/invitations → CreateInvitationUseCase.execute → MemberRepository.findByEmail → db.select().from(members) → InvitationRepository.insert → MailClient.send

Good:
招待の送信（/projects/:projectId/members のフォーム）
└── MembersPage（接続）
    ├── InviteForm（表示）— 入力を受けて onSubmit を呼ぶ
    └── POST /api/projects/:projectId/invitations
        └── CreateInvitationUseCase.execute
            ├── MemberRepository.findByEmail（既存）— members を読む
            ├── InvitationRepository.insert — invitations に書く
            └── MailClient.send（既存）
```

なぜ: 子は、自分の関数の下を見れば何を呼ぶか、上を見れば誰に呼ばれるかが分かる。矢印を 1 列に並べると、A が B と C を呼ぶのか、B が C を呼ぶのかが読めない。木の親子はそのままフェーズの前後になる。クエリは repository の中身で、担当の子が行の型を見て書ける。

### 型

API・関数・props が使う型（エンティティ、エラー、props）を、置くファイルごとに定義する。新しい table は行の型（列名と型）と、業務ルールに関わる制約（unique など）で書き、ORM の定義コードは子に任せる。

```ts
// invitations（新規）。unique: (projectId, email)
type InvitationRow = { id: string; projectId: string; email: string; role: Role; createdAt: Date };
```

なぜ: 同じ型をフェーズごとに定義させると形が少しずつずれ、つなぎ目で型が合わなくなる。列の DB 上の型や index の張り方は、行の型を見て repository の子が決められる。

### API

endpoint ごとに method・path・認証・request・status ごとの response を書く。失敗の status も列挙する。

```md
#### POST /api/projects/:projectId/invitations

- 認証: 必須。project の owner だけ
- request: `{ email: string; role: Role }`
- response: 201 `{ invitation: Invitation }` / 400 入力が不正 / 403 owner ではない / 409 既に member か、未承諾の招待がある
```

なぜ: API と UI を別の子が作るとき、両者が共有するのはこの定義だけ。失敗の status が無いと、UI の子はエラー表示を推測で書く。

### UI

画面（route）ごとに、フォームの項目と、機能を「操作 → 呼ぶ API → 成功・失敗で起きること」で書く。見た目はデザインに任せ、あれば URL を書く。

```md
#### /projects/:projectId/members

| 項目  | 入力   | 必須 | 検証           |
| ----- | ------ | ---- | -------------- |
| email | email  | ✓    | email の形式   |
| role  | select | ✓    | owner / member |

- 送信 → POST /api/projects/:projectId/invitations。201 で招待一覧に足し、409 は email 欄の下に出す
- 招待一覧を出す → GET /api/projects/:projectId/invitations
```

なぜ: 操作と API の対応が書いてあれば、UI の子は API の節と突き合わせるだけで実装できる。

### 関数

ファイルごとに、外から使われる関数・method・component・hook をすべて signature で書き、役割を 1 行添える。component は props の型までを書く。使う既存の関数も「既存」に載せる。中身（ファイル内だけの補助関数、component の内部 state や使う hook、関数の本体）は子に任せる。

UI は、props だけで描く表示 component（Presentational）と、API を呼んで表示 component に渡す接続（Container。route の component や hook）に分ける。表示 component の props は API の response の JSON の形（日付は string）に合わせ、接続が response をそのまま渡せるようにする。

```md
<!-- Bad: 関数を列挙せず作業で済ませる。中身の手順や内部 state を書く -->

- 招待を作る処理を実装する（必要な関数は適宜追加）
- `InviteForm` — useState で email と role を持ち、useMutation で POST する

<!-- Good -->

#### api/usecase/create-invitation.ts（新規）

- `constructor(deps: { invitations: InvitationRepository; members: MemberRepository; mail: MailClient })`
- `execute(args: { projectId: string; email: string; role: Role }): Promise<Result<Invitation, AlreadyMemberError | DbError | MailError>>` — 既に member でなければ招待を保存し、メールを送る

#### web/components/InviteForm.tsx（新規・表示）

- `InviteForm(props: { pending: boolean; error: "already-member" | null; onSubmit: (input: { email: string; role: Role }) => void })` — 招待フォームを描き、送信で onSubmit を呼ぶ

#### 既存

- `api/repository/member.ts` — `MemberRepository.findByEmail(email: string): Promise<Result<Member | undefined, DbError>>`
- `api/client/mail.ts` — `MailClient.send(args: { to: string; subject: string; body: string }): Promise<Result<void, MailError>>`
```

なぜ: 子は設計書しか見ない。一覧に無い関数は session ごとに別の名前・引数で作られ、つなぎ目で合わない。既存の関数を載せれば二重実装も防げる。中身を書くと、user が確かめたいインターフェースが手順に埋もれ、誰も動かしていない処理を子が写すことになる。表示 component は API を待たずに作れて、props を渡すテストで確かめられるので、API と並列のフェーズにできる。

### フェーズ

1 ファイルは 1 フェーズだけが持つ。前提は呼び出しの木と型の import で決め、呼ぶ側は呼ばれる側のフェーズが終わってから始める。表示 component は使う型だけを前提に API と並列に作り、接続はその両方が終わってから作る。1 フェーズは 1 session で終わる大きさにし、確かめられる完了条件を付ける。

```md
<!-- Bad: 2 つのフェーズが api/routes/index.ts を持ち、UI 全体が API を待って直列になる -->

| フェーズ | 担当ファイル                                   | 前提 |
| -------- | ---------------------------------------------- | ---- |
| 1 API    | api/routes/invitations.ts, api/routes/index.ts | なし |
| 2 UI     | web/routes/members.tsx, api/routes/index.ts    | 1    |

<!-- Good: 1 → 2 と 3 を並列 → 4 -->

| フェーズ | 担当ファイル                                                                                                   | 前提 | 完了条件                       |
| -------- | -------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------ |
| 1 型     | shared/invitation.ts                                                                                           | なし | 型チェックが通る               |
| 2 API    | api/routes/index.ts, api/routes/invitations.ts, api/usecase/create-invitation.ts, api/repository/invitation.ts | 1    | use case のテストが通る        |
| 3 表示   | web/components/InviteForm.tsx                                                                                  | 1    | props を渡した描画テストが通る |
| 4 接続   | web/routes/members.tsx                                                                                         | 2, 3 | 型チェックと画面のテストが通る |
```

なぜ: 並列の子が同じファイルを触ると、片方の変更が上書きされるか merge で衝突する。呼ぶ先がまだ無いフェーズは型チェックが通らず、完了を確かめられない。大きすぎるフェーズは子の context を使い切り、途中で設計書の前提を落とす。

## 引き継ぎ prompt

フェーズごとに次の形で出す。子は会話の履歴を持たないので、設計書は絶対 path で指す（worktree を分けても同じ設計書を読める）。

```md
<設計書の絶対 path> の「フェーズ N」を実装してください。

- 触るのは担当ファイルだけ。関数・型・API は設計書の signature に合わせる（戻り値の型は、導出された型が一致すればよい）。ファイルの中だけで使う補助関数は自由に足してよい
- 設計書のとおりでは実装できない、または担当外のファイルを変える必要が出たら、そこで止めて理由と変更案を報告する
- 完了条件: <フェーズの完了条件>
- 最後に、変更したファイル・完了条件の確認結果・設計書との差分を報告する。commit はしない
```

子に止めて報告させるのは、他の子が同じインターフェースを前提に並列で進んでいるから。user がその報告を root に持ってきたら、root が設計書を直し、影響するフェーズと出し直す引き継ぎ prompt を示す。
