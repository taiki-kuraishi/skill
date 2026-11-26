# DB のスキーマを変える

**持つもの: drizzle の schema と、生成した migration の PR まで。本番への適用は持たない。**

使う場面: drizzle の schema（テーブル・列・制約・index・外部キー）を変え、`drizzle-kit generate` で migration を作って PR を出す。`kstack-worktree-diff` の「1 フェーズで変更する package は 1 つ」に従い、schema を持つ package だけを変える。schema を使う API の変更は、このあとで API の playbook として回す。

1. 変更を決める。足す・変える列ごとに、型・null を許すか・既定値・既存の行の値を、外部キーごとに onDelete を書き出す。依頼・文書に無い項目は `kstack-playbooks` の「playbook の回し方」の手順 2 で聞く。onDelete は `kstack-drizzle-orm` のとおり必ず user に聞く。完了条件: 各項目に出典か user の答えがある
2. schema を変える。`kstack-monorepo` の「DB の共有 package にロジックを置かない」に従い、schema の定義だけを変える
3. migration を生成する。repo の script（`package.json` の scripts、mise の task）にある generate を使い、無ければ `drizzle-kit generate` を使う。生成された SQL と meta（snapshot・journal）は手で直さない。手順 4 で手書きの migration が要ると user と決めたときだけ、`kstack-drizzle-orm` のとおり書く。完了条件: schema の変更が migration の SQL に出ている
4. 生成された SQL を読む。DROP、テーブルの作り直し（SQLite の `__new_<table>` と `PRAGMA foreign_keys=OFF`）、既存の行が NOT NULL を満たさない変更があれば、`kstack-drizzle-orm` のとおり、データのある環境に流す手順を user と決める。完了条件: 消える・作り直されるテーブルと列が無いか、流す手順に user の答えがある
5. 確かめる。空の DB に全 migration を流すことと、schema を使う package のテストと型検査を、subagent に実行させる
6. PR を出す。読み込んだ mode の出し方に従う（bot は `kstack-bot-driven-development` の「フェーズを stack に積む」、それ以外は `kstack-git` の「PR の作り方」）。schema・migration の SQL・meta を同じ commit にする。PR の body に、各環境へ migration を流す手順と、手順 4 で決めたことを書く。migration を環境に流すのは、user の明示の指示があるときだけにする

```text
Bad: NOT NULL の列を既定値なしで足し、生成された SQL を読まずに PR を出す
Good: 既存の行に入れる値を聞いてから schema を変え、SQL の作り直しが無いことを確かめて PR に流す手順を書く
```

なぜ: migration は流すとデータが変わり、戻せないことがある。生成された SQL を PR の前に読めば、作り直しやデータの欠けを本番に流す前に止められる。

**報告**: 変えたテーブルと列、手順 1 の項目と出典、migration のファイル名、SQL を読んで分かったこと、PR の URL、流す手順。
