---
name: kstack-playbooks
description: kstack-agent-mode・kstack-bot-mode が最初に読む、作業の原則と、依頼を playbook に振り分ける表と回し方。playbook と kstack SKILL で決まっている作業の user review は kstack-review-exemption に従って省き、どの playbook にも当たらない、コードや文書を変える依頼は kstack-root-driven-development で設計とフェーズを user と確かめる
disable-model-invocation: true
---

# kstack-playbooks

`kstack-agent-mode`（単独の session）と `kstack-bot-mode`（bot）が、作業の最初に全文読む。下の原則を作業の間ずっと使い、依頼を repo の playbook と振り分け表で 1 つの playbook か開発フローに渡す。kstack の playbook は `playbooks/<名前>.md` にあり、この SKILL.md と同じディレクトリから読む（omp なら `skill://kstack-playbooks/playbooks/<名前>.md`）。repo の playbook は、下の「repo の playbook」のとおり作業する repo の root から読む。要件の確かめ方、user に聞いて止まるか進むか、agent の使い方は mode ごとに違うので、読み込んだ mode に従う。聞くときの書き方は `kstack-user-question` に従う。

## 原則

user が原則の名前で指示したら（「実物で確かめるでやり直して」）、その行に従ってやり直す。

- **ゴールと背景から書く** — subagent・worker への依頼、PR の body、報告は、目的・背景（なぜ今それをやるか）・完了条件から書き始める。背景を知らない agent は、完了条件を満たすだけの近道を選ぶ
- **実物で確かめる** — 完了と言う前に、変えたものを実際に動かして確かめる（再現の手順を流し直す、画面を開く、コマンドの出力を読む）。型検査・lint・「build が通った」・subagent の自己申告は証拠にしない
- **根本原因を直す** — 症状が出た場所ではなく、最初に間違えた場所を直す。guard・retry・エラーの握りつぶしは、その状態が正当に起こり得るときだけ足す。同じ原因の箇所はまとめて直す
- **前提を疑う** — 同じ前提に立つ修正が 2 回失敗したら、3 回目を書く前にその前提を 1 文で書き、前提そのものを確かめる
- **足す前に削る** — 完了条件を満たす最小の変更にする。使われていないコードや重複を先に消し、頼まれていない汎用化・設定・抽象を足さない
- **検証できる単位で進める** — 1 つ変えたら確かめてから次へ進む
- **戻せる作業は止まらない** — 調査や手元の編集のように戻せる作業は、聞かずに進めて結果と理由を示す。merge・deploy・データの削除・force-push・外部への送信は、user の明示の指示があるときだけ行う。commit・push・PR のタイミングは読み込んだ mode に従う
- **同じ指摘は構造にする** — 同じ指摘を 2 回受けたら、SKILL への追記か lint にする案を報告に添える。文章の指示を増やすより、守らないと落ちる形の方が効く

```text
Bad: subagent に「このテストを直して」とだけ頼み、返ってきた「直りました」をそのまま報告する
Good: 依頼を目的・背景・完了条件から書き、直ったかは同じテストを流し直した出力で確かめてから報告する
```

なぜ: 原則は、playbook のどの手順にも書かれていない場面の判断に使う。名前で呼べるようにしておけば、user は長い指示を書かずに作業を直せる。

## repo の playbook

作業する repo の root に `.agents/playbooks/` があれば、その中の `*.md` を repo の playbook として使う。形は `playbooks/` の playbook と同じにし、「使う場面:」の行を振り分けの 1 行として読む。

1. 作業の最初に、`.agents/playbooks/*.md` をファイル名の順に開き、「使う場面:」の行だけを読む。完了条件: 各ファイルの名前と使う場面の一覧ができている（ディレクトリが無ければ一覧は空）
2. 依頼を、下の振り分け表より先に、この一覧の上から照らす。当たったら、そのファイルを全文読み、「playbook の回し方」で回す
3. kstack の playbook と同じ名前のファイルは、kstack の playbook の代わりに使う。振り分け表のその行は、repo のファイルを指しているものとして読む

repo の playbook は、手順の中で kstack の SKILL と playbook を参照してよい。AGENTS.md には規約と承認が要る操作を短く書き（`kstack-agents-md`）、repo の playbook には、それを使って繰り返す作業の手順と完了条件を書く。repo の playbook を足す・変える依頼は、どの playbook にも当たらない依頼として扱い、`kstack-user-question` の「何を作るかの承認は、中身を見せて取る」で下書きを見せてから書く。

```text
Bad: repo の `.agents/playbooks/post-deploy-watch.md` を読まずに、kstack の post-deploy-watch でログの場所を推測する
Good: 同じ名前の repo の playbook があるので、そちらを全文読み、その repo のログの場所と版の確かめ方で回す
```

なぜ: ログの場所、リリースの手順、使っている環境のように、repo ごとにしか決まらない手順がある。kstack に書くと全 repo に効いてしまい、書かなければ毎回 user に聞くことになる。repo に置けば、その repo の作業だけが同じ手順で回る。

## 振り分け

依頼を上の行から照らし、最初に当たったものを使う。repo の playbook があれば、表より先に上の「repo の playbook」の手順で照らす。依頼が 2 つ以上にまたがるとき（調べてから直す）は、前のものを終えてから次を選び直す。commit だけ、質問に答えるだけのように、コードも文書も変えない単発の依頼は表に照らさず、その操作の SKILL（`kstack-git` など）に従う。

| 依頼                                                                                     | 使うもの                                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| デプロイ後に、本番で変えた箇所が動いているか確かめる                                     | `playbooks/post-deploy-watch.md`                                                                                                 |
| 仕組み・原因・是非を知りたい。コードは変えない                                           | `playbooks/investigation.md`                                                                                                     |
| PR か commit の CI が落ちた                                                              | `playbooks/ci-fix.md`                                                                                                            |
| CI の workflow・git hook・mise task を変えて、検査の動きを変える                         | `playbooks/ci-config.md`                                                                                                         |
| 期待する動きが文書・テスト・依頼・既存の挙動で決まっている不具合を直す                   | `playbooks/bug-fix.md`                                                                                                           |
| 既存のコードにテストを足す・テストの書き方を直す                                         | `playbooks/tests.md`                                                                                                             |
| コードを kstack SKILL の規約に、文書を実装に合わせる                                     | `playbooks/conformance.md`                                                                                                       |
| drizzle の schema（テーブル・列・制約・index・外部キー）を変える                         | `playbooks/db-schema.md`                                                                                                         |
| Terraform を変えて plan を PR に出す                                                     | `playbooks/terraform.md`                                                                                                         |
| monorepo に package・app を足す                                                          | `playbooks/new-package.md`                                                                                                       |
| 業務ルールを定理で検証しながら API を作る                                                | `kstack-verification-guided-development`                                                                                         |
| Hono・better-result・drizzle で層を分けた API の endpoint を作る・振る舞いを変える       | `playbooks/api.md`                                                                                                               |
| 画面を作る・表示や操作を変える                                                           | `playbooks/screen.md`                                                                                                            |
| diff・PR をレビューする                                                                  | `kstack-root-driven-development` 手順 5 の 3 つの review を subagent で並行に回し、報告を 1 つにまとめる。コードも PR も変えない |
| PR を出す                                                                                | `kstack-git` の「PR の作り方」。フェーズを積むときは `kstack-bot-driven-development` の「フェーズを stack に積む」               |
| PR を merge する（user が merge を指示した）                                             | `kstack-git` の「PR を merge する」。stack は `kstack-bot-driven-development` の「merge」                                        |
| 実装を子 session に並列で任せる（kstack-agent-mode のみ）                                | `kstack-handoff`                                                                                                                 |
| コードか文書を変える依頼で、どれにも当たらない（設計を変えるリファクタリング、試作など） | 下の「playbook に当たらない依頼」                                                                                                |

## playbook の回し方

1. 選んだ playbook の手順を、要約も並べ替えもせずに todo へ写してから始める。完了条件: todo に playbook の全手順が並んでいる
2. 手順の途中で、SKILL にも playbook にも決まっていない判断が要ったら、その判断だけを読み込んだ mode の決まりで扱い、user に聞くときは `kstack-user-question` の書き方にする。`kstack-root-driven-development` の「既存パターンから外れる実装」、期待する動きがどこにも書かれていないこと、データを消すなどの戻せない操作、UI の見た目がこれに当たる。判断が目的や対象を変えるなら、下の「playbook に当たらない依頼」に切り替える
3. コードか文書を変えたら、出す前に `kstack-root-driven-development` 手順 5 の 3 つの review を subagent で回して直す。playbook の作業でも省かない
4. user review を省けるかは `kstack-review-exemption` の「mode から使うとき」で決める
5. 報告は playbook の「報告」の項目を、目的と背景から書く

```text
Bad: バグ修正の途中で「API の返す形を変える方が早い」と判断し、そのまま変えて review なしで commit する
Good: 返す形を変えるのは playbook に決まっていない判断なので、その 1 点だけ user に聞いて答えを待つ
```

なぜ: user review を省けるのは、手順と書き方が SKILL と playbook で決まっているからである。決まっていない判断を混ぜたまま省くと、user が決めるべきことが見られないまま入る。

## playbook に当たらない依頼

`kstack-root-driven-development` で進める。手順 2 で目的・対象・完了条件・対象外を user と合意したあと、手順 3 の一覧と最初のフェーズの設計も user に確かめてから実装する（root-driven の手順 3 は通知だけで進むが、ここでは確かめる）。bot での進め方は `kstack-bot-mode` に従う。

```text
Bad: 機能追加の依頼を、近いバグ修正の playbook に寄せて進める
Good: どの playbook にも当たらないので、root-driven で目的とフェーズの設計を user と確かめてから実装する
```

なぜ: playbook に当たらない作業は、設計とフェーズの切り方がどこにも決まっていない。先に user と合わせておけば、作り直しと実装中の聞き直しが減る。
