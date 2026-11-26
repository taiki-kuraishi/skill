---
name: kstack-playbook-proposal
description: kstack-agent-mode・kstack-bot-mode で作業を終えたときに読み、終えた作業の流れを新しい playbook にする下書きか、使った playbook の直し方を user に提案する手順。playbook に当たらない依頼を終えたときと、playbook から外れて進めたときに、また来る作業で、まだどこにも書かれていないものに限って 1 つまで出し、置き場所（kstack の playbook か repo の .agents/playbooks/）を決め、下書きの全文を見せ、承認を受けるまで書かない
disable-model-invocation: true
---

# kstack-playbook-proposal

`kstack-playbooks` の「作業を終えたら」から読む。user が `/kstack-playbook-proposal` で呼んだときは、その session で終えた作業を対象にする。

## 提案するかを決める

終えた作業が次のどれに当たるかを決める。

1. 依頼が `kstack-playbooks` の「playbook に当たらない依頼」だった → 新しい playbook の候補にする
2. playbook を使ったが、回し方の手順 2 に当たる判断（`kstack-agent-mode` は user に聞いたもの、`kstack-bot-mode` は PR の `未解決事項` に書いたもの）、手順に無い作業、手順の入れ替えかやり直しがあった → その playbook の直しの候補にする
3. どちらでもない → 提案しない。報告にも何も書かない

候補は、次をすべて満たすときだけ残す。残った候補が 2 つ以上なら、次の作業に一番効く 1 つにする。

- 同じ種類の依頼が、その repo か kstack を使う他の repo でまた来る
- 書けば、次の agent の進め方か、user に聞く判断・`未解決事項` に書く判断が変わる
- kstack の SKILL・playbook、repo の playbook、AGENTS.md のどこにもまだ書かれていない
- SHA、版、件数のような、すぐ古くなる事実だけでできていない

```text
Bad: typo の修正を終えて「typo 修正の playbook」を提案する / 作業を終えるたびに提案を並べる
Good: playbook に当たらなかった Worker の削除を終え、動いている Workflow の確かめ方を毎回 user に聞いていたので、その確かめ方を手順と完了条件にした下書きを出す
```

なぜ: 提案を読んで承認するのは user の手間になる。また来ない作業や、もう書かれていることを提案しても、その手間だけが残る。

## 置き場所を決める

- repo に依らない手順は、kstack の playbook（`taiki-kuraishi/skill` の `skills/kstack/kstack-playbooks/playbooks/`）にする。振り分け表に足す行も一緒に出す
- その repo でしか決まらない手順は、その repo の `.agents/playbooks/` にする（同じ名前なら kstack の playbook を置き換える。`kstack-playbooks` の「repo の playbook」）

## 下書きを見せる

`kstack-user-question` の「何を作るかの承認は、中身を見せて取る」のとおり、下書きの全文を見せる。新しい playbook は `kstack-playbooks` の playbook と同じ形（持つもの / 使う場面 / 手順と完了条件 / Bad・Good / なぜ / 報告）で書く。直しは、変える行の今と案を並べる。どちらにも、元にした事実（終えた作業で聞いた判断、やり直した箇所）と置き場所を添える。

- `kstack-agent-mode` では、最後の返答に添える
- `kstack-bot-mode` では、依頼元への最後の通知に添える。答えを待って止まらない

承認を受けるまで書かない。承認を受けたら、書く作業を新しい依頼として mode で進める。kstack の playbook は `taiki-kuraishi/skill` の変更に、repo の playbook はその repo の変更にし、push と PR は mode の決まりに従う。

```text
Bad: 作業の流れが良かったので、承認を取らずに `.agents/playbooks/worker-delete.md` を足して commit する
Good: 下書きの全文と置き場所を最後の返答に添え、承認を受けてから別の依頼として足す
```

なぜ: playbook の手順で決まった変更は、`kstack-review-exemption` の条件 1 で user review を省く根拠になる。user が中身を見ないまま playbook が増えると、user が決めていない手順で review が省かれる。
