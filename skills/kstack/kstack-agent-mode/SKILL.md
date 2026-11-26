---
name: kstack-agent-mode
description: user が対話しながら使う単独の session の入口。依頼の目的・背景・完了条件を確かめ、kstack-playbooks の原則を使い、依頼を playbook に振り分け、kstack-root-driven-development の役割分担で root が編集して subagent に事実と review を任せて進める。playbook と kstack SKILL で決まっている作業は kstack-review-exemption の判定を通れば user review なしで commit し、どの playbook にも当たらない依頼は root-driven で設計とフェーズを user と確かめる
disable-model-invocation: true
---

# kstack-agent-mode

user が `/kstack-agent-mode` で呼んだ session を、最後までこの SKILL で進める。始める前に `skill://kstack-playbooks`（原則・振り分け表・playbook の回し方）と `skill://kstack-root-driven-development` を全文読む。playbook と、この SKILL が指す SKILL・ファイルは、読み込んだ SKILL.md のディレクトリから解決する。読めなければ、試した absolute path とエラーを user に示して止まる。

進め方は playbook と root-driven に従い、この SKILL は入口として次の 4 点だけを決める。

## 要件を確かめる

最初の返答で、依頼の目的・背景（なぜ今それをやるか）・完了条件・対象外と、選んだ playbook を書く。依頼から決められない項目だけ、`kstack-root-driven-development` 手順 2 の聞き方（chat で 1 回 1 問、背景と判断材料を添える）で聞く。SKILL と playbook で決まっていることは聞かない。決められない項目が無ければ、承認を待たずに進める。playbook の回し方の手順 2 で user に聞くときも、同じ聞き方にする。

```text
Bad: 「CI が落ちたので直して」に、目的・対象・完了条件・対象外の承認を求めて止まる
Good: 「目的: PR #12 の CI を通す。背景: merge できない。完了条件: 落ちた check が通る。playbook: CI の失敗を直す」と書いて進める
```

なぜ: 書いた目的と背景は、そのまま subagent への依頼の冒頭になる。決まっている作業で承認を待つと、user は答えの決まった問いに時間を使う。

## 原則と playbook

依頼を `kstack-playbooks` の振り分け表で選ぶ。playbook を選んだら「playbook の回し方」で進め、SKILL（`kstack-git`・`kstack-handoff` など）を選んだらその SKILL に従う。原則は作業の間使い、返答では、判断を変えた原則の名前と、変えた判断を 1 行で添える。

```text
Bad: 「原則に従いました」とだけ書く
Good: 「根本原因を直す: guard を足す案をやめ、token の期限の比較を直した」と書く
```

なぜ: 原則と変えた判断を対で書けば、user はどの判断が気に入らないかを原則の名前で言える。

## agent の使い方

役割は `kstack-root-driven-development` の「責務」と「Subagent contract」に従い、次の 3 点だけ置き換える。

- 依頼は、目的・背景・完了条件から書き始め、Subagent contract の 7 項目をそのあとに並べる
- 振り分け表で `kstack-handoff` を選んだときは、root-driven の「`kstack-handoff` は使わない」に代えて、実装・user review・commit を `kstack-handoff` の手順で子 session に任せる
- user review を省けるかの判定は、`kstack-review-exemption` のとおり fresh-context の subagent に決めさせる。root は自分で判定しない

```text
Bad: 「src/api のテストを流して」とだけ頼む / review を省けるかを root が自分で決める
Good: 「目的: 期限切れ token の 500 を直す。背景: ログインし直せない user が出ている。完了条件: test/auth.test.ts の再現が通る。…（7 項目）」と頼む
```

なぜ: subagent は会話を見ていない。背景が無いと、完了条件を満たすだけの近道を選び、root はその近道を見抜くために出力を読み直すことになる。

## commit と user review

playbook 1 つ分の作業を 1 フェーズとし、その差分だけを review と commit の対象にする。`kstack-review-exemption` の「mode から使うとき」の判定がすべて「満たす」なら user review を開かずに commit し、そうでなければ root-driven の手順 6 で user review を受けてから commit する。playbook に当たらない作業は root-driven の、`kstack-handoff` の作業はその SKILL のフェーズと commit の手順で進める。push・PR・merge は、user の明示の指示か、選んだ playbook の手順にあるときだけ行う。

```text
Bad: playbook の作業なので、判定をせずに commit する / commit したので push する
Good: 判定がすべて「満たす」ことを確かめてから commit し、push は指示を待つ
```

なぜ: user review を省けるのは、決まっていない判断が無いと判定で分かったときだけである。push と PR は repo の外の人に見えるので、commit と別の判断にする。
