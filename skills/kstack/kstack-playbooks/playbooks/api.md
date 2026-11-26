# API を作る・直す

**持つもの: 1 つの endpoint が、型付き client とテストまで含めて動くこと。**

使う場面: Hono の route・層ごとの class（`kstack-layerd-architecture`）・better-result・drizzle で書かれた API の endpoint を作る、または振る舞いを変える。期待する動きが決まっている不具合はバグ修正、DB のスキーマの変更は DB スキーマの変更の playbook を先に回す。endpoint が複数あるときは、`kstack-worktree-diff` の「1 フェーズで実装する API は 1 つ」に従い、endpoint ごとにこの playbook を回す。

1. endpoint を決める。HTTP method と path、request（path・query・body）、response、認可、失敗ごとの HTTP status を 1 つずつ書き出し、`kstack-rest-api` の 3 つの規約に照らす。依頼・既存の route・文書のどれにも書かれていない項目は、`kstack-playbooks` の「playbook の回し方」の手順 2 で聞く。完了条件: 6 項目すべてに出典か user の答えがある
2. 置き場所を決める。既存の route・use case・repository・client のどれに足すかを、`kstack-layerd-architecture` の各層の規約と、`kstack-monorepo` の「責務に合わない処理は package を新設して置く」に照らして決める。新しいディレクトリ・package・層が要るなら、`kstack-root-driven-development` の「既存パターンから外れる実装」として聞く。完了条件: 変えるファイルの一覧が既存のファイルか、承認された新しい置き場所だけでできている
3. 内側から書く。repository（`kstack-drizzle-orm`）、client、use case（`kstack-layerd-architecture`・`kstack-better-result`）、route（`kstack-rest-api` の request schema、`kstack-hono` の型付き client）の順にする。use case の失敗は TaggedError で返し、route で手順 1 の HTTP status に変える。親の行を消す変更は、`kstack-drizzle-orm` のとおり子の扱いを user に聞く
4. テストを書く。`kstack-testing` に従い、route 定義ファイルの spec に、正常系 1 件と手順 1 の失敗ごとに 1 件を足す。validator が弾く 400 は、`kstack-testing` のとおりテストしない。DB は `kstack-drizzle-orm` の in-memory DB に、認証が要るなら `kstack-better-auth` の instance にする。完了条件: 手順 1 の status（validator の 400 を除く）ごとに 1 件以上のテストがある
5. 確かめる。手順 4 の spec と型検査を subagent に流させ、通った出力を受け取る。型付き client を使う側があれば、その型検査も流させる

```text
Bad: 既存に無い 403 / 404 の使い分けを自分で決め、use case で HTTP status を返す
Good: 使い分けを聞いてから、use case は TaggedError を返し、route で status に変える
```

なぜ: endpoint の形と失敗の扱いは、API を使う側との約束である。書く前に出典か答えをそろえれば、user review を省いても、約束を agent が勝手に決めたことにならない。内側から書くと、各層をその層の規約だけで確かめられる。

**報告**: endpoint（method・path）、手順 1 の 6 項目と出典、変えたファイル、通ったテストの出力。
