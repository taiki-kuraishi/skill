---
name: kstack-bot-mode
description: bot（Orca の bot など、user と対話しながら作業しない agent）の入口。kstack-bot-driven-development の通知に背景と選んだ playbook か SKILL を足し、kstack-playbooks の原則を使い、依頼を playbook に振り分けて bot-driven の draft PR で進める。PR の変更を含む依頼の完了条件は merge と反映の後の状態で書き、確かめる前に依頼や進捗の記録（Orca の Item など）を完了にしない。playbook と kstack SKILL で決まっている作業は kstack-review-exemption の判定を通れば user review なしで出し、どの playbook にも当たらない依頼は設計とフェーズを依頼元と確かめてから進める。別の session に任せるときは、依頼の最初に bot-mode・playbooks・bot-driven・root-driven・kstack-git の SKILL.md を absolute path で読ませ、PR を作った後に reviewer subagent で体裁を確かめるよう書く
disable-model-invocation: true
---

# kstack-bot-mode

bot が `/kstack-bot-mode` で受けた依頼を、最後までこの SKILL で進める。始める前に `skill://kstack-playbooks`（原則・振り分け表・playbook の回し方）と `skill://kstack-bot-driven-development`（と、それが読ませる `kstack-root-driven-development`）を全文読み、`kstack-playbooks` の「repo の playbook」の手順 1 で、作業する repo の playbook の一覧を作る。kstack の playbook と、この SKILL が指す SKILL・ファイルは、読み込んだ SKILL.md のディレクトリから解決する。読めなければ、試した absolute path とエラーを依頼元に送って止まる。

進め方は playbook と bot-driven に従い、この SKILL は bot-driven に次の 5 点を足す。user review を省いた PR も draft のまま出し、merge は bot-driven の「merge」のとおり user の明示の指示を待つ。

## 通知に背景と playbook を足す

bot-driven 手順 1 の通知（目的 / 対象 / 完了条件 / 対象外）に、背景（なぜ今それをやるか）と、選んだ playbook か SKILL（2 つ以上にまたがるときは `kstack-playbooks` の「振り分け」の見込みの並び）を足す。依頼に背景が無ければ、依頼元・関係する issue や PR から読み取って書き、読み取れなければ「背景: 依頼に無い」と書いて進める。

```text
Bad: 「目的: CI を通す」とだけ通知する
Good: 「目的: Renovate PR #34 の CI を通す。背景: 依存の更新が止まっている。対象: … 完了条件: 落ちた check が通り、PR が merge される。対象外: … playbook: CI の失敗を直す」と通知する
```

なぜ: 通知に書いた目的と背景は、そのまま agent への依頼と、PR の body の「概要」節（`kstack-git` の「PR の作り方」手順 4）の中身になる。背景が無いと、依頼を受けた agent は完了条件を満たすだけの近道を選ぶ。

## 完了は、merge と反映を確かめてから

PR の変更を含む依頼では、通知の完了条件を、依頼元が求める結果を merge と反映の後の状態で書く。「PR を出した」や「check が通る」のように bot だけで満たせる状態を完了条件にすると、bot は依頼元の判断より先に完了を宣言することになる。別の session に任せるときは、その session の完了条件を merge できる状態までにし、merge の後の確認は bot が行う。bot-driven 手順 3 の最後に PR の URL を並べるのは merge 待ちの報告で、完了の報告ではない。依頼元への完了の報告と、進捗の記録（Orca の Item など）を完了にする操作は、完了条件を自分で確かめた後か、依頼元が完了にしてよいと言ったときだけ行う。完了条件に依頼元の作業（merge、投稿など）が残っていれば、その作業を待っている状態にして、bot の側では完了にしない。

```text
Bad: 完了条件を「ログインの不具合を直す PR を出した」と書き、PR を出した時点で Item を完了にする
Good: 完了条件を「PR が merge され、deploy 先でログインできることを確かめた」と書き、PR を出したら Item を merge 待ちにし、merge の後に確かめてから完了にする
```

なぜ: merge や反映の前に完了にすると、依頼元は残っている作業を一覧から見失い、終わっていない依頼を自分で開け直すことになる。

## 原則と playbook

依頼を `kstack-playbooks` の「repo の playbook」と振り分け表で選ぶ。playbook を選んだら「playbook の回し方」で進め、コードか文書を変える playbook は bot-driven のフェーズ（gh stack の draft PR）にする。SKILL を選んだらその SKILL に従う。原則は作業の間使い、通知と PR の body では、判断を変えた原則の名前と、変えた判断を 1 行で添える。

回し方の手順 2 に当たる判断は、bot-driven の手順 2 と同じく、既存に倣う案で進めて PR の `未解決事項` に書く。既存に倣う案が無い判断と、戻せない操作だけ止まって聞く。決めきれない判断が残った PR は、`kstack-review-exemption` の条件 3 で外れて user review に出る。

```text
Bad: テストの期待値を変えるかを聞いて、返事が来るまで止まる / 期待値を変えたことを PR に書かずに出す
Good: 期待値を変えない案で進め、変える案と代償を PR の `未解決事項` に書き、その PR は user review に出す
```

なぜ: bot の依頼元はその場で返事をしないので、聞いて止まると作業がそこで止まる。決めた判断が PR に残れば、user は後から PR で覆せる。

## playbook に当たらない依頼

`kstack-playbooks` の「playbook に当たらない依頼」を、依頼元と非同期で行う。bot-driven の「止まって聞くのは手順 1・2 の場合だけ」の例外として、目的と完了条件が決められても、手順 1 の通知を合意を求める問いにし、やることの一覧と最初のフェーズの成果・完了条件を加えて送り、返事を待つ。合意したら bot-driven で実装し、2 つ目以降のフェーズは通知して進める。合意の範囲を変える必要が出たら、同じ形で聞いて止まる。

```text
Bad: 機能追加の依頼を、bot が設計を決めて PR まで出す
Good: 目的とフェーズの一覧・最初のフェーズの設計を送り、合意を受けてから最初の PR を作る
```

なぜ: 設計とフェーズの切り方が決まっていない作業を bot だけで進めると、user は PR になってから設計を見ることになり、作り直しが大きくなる。

## agent の使い方

役割は bot-driven と root-driven の「責務」「Subagent contract」に従い、次の 3 点だけ足す。

- subagent への依頼は、目的・背景・完了条件から書き始め、Subagent contract の 7 項目をそのあとに並べる
- user review を省けるかの判定は、`kstack-review-exemption` のとおり fresh-context の subagent に決めさせる。root は自分で判定しない
- bot-driven のとおりフローごと別の session（Orca の worker など）に任せるときは、依頼の最初に、次の 5 つの SKILL.md を absolute path で並べて「全文読んでから始める」と書く: この SKILL、`kstack-playbooks`、`kstack-bot-driven-development`、`kstack-root-driven-development`、`kstack-git`。続けて「PR を作った後に、`kstack-git` の『PR の作り方』手順 6・7 の reviewer subagent に PR の体裁を確かめさせる」と書き、そのあとに目的・背景・完了条件・選んだ playbook を書く。PR を開いた session が、CI と review の指摘に応えて merge できる状態になるまでその PR を持つ

```text
Bad: worker に「#45 の bug を直して」とだけ送る
Good: 「次の 5 つを全文読んでから始める: /home/me/.agents/skills/kstack-bot-mode/SKILL.md、…/kstack-playbooks/SKILL.md、…/kstack-bot-driven-development/SKILL.md、…/kstack-root-driven-development/SKILL.md、…/kstack-git/SKILL.md。PR を作った後に reviewer subagent に体裁を確かめさせる。目的: … 背景: … 完了条件: … playbook: バグ修正」と送る
```

なぜ: `/kstack-bot-mode` で読み込んだ取り決めは、新しく起動した session には届かない。この SKILL だけを読ませると、その session は `kstack-git` を読まずに PR の title・節・assignee を自分で決めることがある。subagent を使わないよう前置きされた環境（Orca の worker など）では、依頼に書かない限り体裁の確認も行われない。absolute path なら、`skill://` を解決できない環境でも読める。
