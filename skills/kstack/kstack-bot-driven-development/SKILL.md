---
name: kstack-bot-driven-development
description: bot（user と対話しながら作業しない agent）が、user との要件・フェーズの合意を取らずに依頼からフェーズを切り出して実装し、各フェーズを kstack-git に沿って commit し、gh stack で積んだ draft PR として出して user review を PR で受け、承認を待たずに次のフェーズへ進む開発フロー。PR の review 指摘・CI の失敗はそのフェーズの branch で直して上の branch に伝える
disable-model-invocation: true
---

# kstack-bot-driven-development

bot が依頼を受けて最後まで自分で進めるための開発フロー。フェーズの切り出し・実装・review subagent の回し方は `skill://kstack-root-driven-development` の手順 1・3・4・5 に従い、この SKILL は次の 3 点を置き換える。user が見るのは PR だけにし、bot は user の返事を待って止まらない。

| root-driven-development                           | この SKILL                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| 手順 2: 要件を user と 1 問ずつ合意する           | 手順 1: 依頼から root が決め、通知して進む                       |
| 既存パターンから外れる実装は書く前に承認を取る    | 手順 2: 既存に倣う案で書き、外れる案は PR の `未解決事項` に残す |
| 手順 6: Crit の user review gate で承認まで止まる | 手順 3: gh stack の PR に出し、承認を待たずに次のフェーズへ進む  |

root-driven-development の手順 3・4・5 にある「前のフェーズが承認されてから切り出す」「範囲の変更や未決事項は聞いて止まる」「書く前に user の承認を求める」「gate で user に聞く」も、この SKILL では止まらずに進め、判断したことと user に決めてほしいことをそのフェーズの PR の `未解決事項` に書く。止まって聞くのは下の手順 1・2 の場合だけにする。`kstack-review-request`（Crit）は使わない。commit・PR の書き方は `skill://kstack-git` に従う。

## Workflow

1. **目的を決めて通知する** — 依頼から `目的 / 対象 / 完了条件 / 対象外` を root が決め、依頼元に通知して承認を待たずに進む。依頼から目的か完了条件が決められないときだけ、背景と判断材料を添えて 1 問だけ聞いて止まる。root-driven-development 手順 3 のフェーズの通知も同じく承認を待たない
2. **既存パターンから外れそうなら既存に倣う** — root-driven-development の「既存パターンから外れる実装」に当たる案は書かず、既存に倣う案で実装する。外れる案とその代償は、そのフェーズの PR の `未解決事項` に 1 行で書く。既存に倣う案が無いときだけ、両案を示して止まって聞く
3. **フェーズを PR に出して次へ進む** — root-driven-development 手順 5 の review で直した後、下の「フェーズを stack に積む」で PR を出し、依頼元に PR の URL を通知する。承認を待たずに手順 3（root-driven-development）に戻り、次のフェーズを切り出す。一覧に残りが無ければ、全 PR の URL を下の層から順に並べて終わる

```text
Bad: フェーズの PR を出した後、user の approve を待って止まる / 依頼の解釈を user に確認してから始める
Good: 目的と完了条件を通知して始め、フェーズごとに PR を出して URL を伝え、そのまま次のフェーズを実装する
```

なぜ: bot の依頼元はその場で返事をしないので、確認や承認を待つと作業がそこで止まる。決めたことを通知と PR に残せば、user は後から PR で判断を覆せる。

## フェーズを stack に積む

1. フェーズの実装を始める前に branch を作る。最初のフェーズは default branch から `gh stack init <topic>`、2 つ目からは `gh stack add <topic>`（`-m`・`-A` を付けない）。branch 名は kebab-case でフェーズの成果を表す。既に PR のある branch から始めるときは `gh stack init --base <default branch> <その branch>` で取り込んでから `gh stack add` する
2. 現在のフェーズの変更だけを stage し、`kstack-git` の「commit の書き方」で commit する
3. `gh stack submit --auto` で push し、draft PR を作る。`--auto` の PR は title が branch 名、body が空、assignee が無いので、`gh pr edit <URL>` で `kstack-git` の「PR の作り方」手順 3・4 の title と body にし、`--add-assignee @me` を付ける。body の `確認方法` には review subagent で直したことを、残った判断は最後に `未解決事項` 節を足して書く
4. `kstack-git` の「PR の作り方」手順 6・7 で、subagent に PR の体裁を確かめさせる。base が 1 つ下のフェーズの branch（最初のフェーズは default branch）になっているかも見させる
5. push した commit の CI を `kstack-git` の「push した commit の CI を完了まで監視する」で監視する。監視は background job にし、終わるのを待たずに次のフェーズへ進む

```text
Bad: 全フェーズを 1 つの branch に積み、最後に 1 つの PR にする / gh stack submit の自動の title・空の body のまま通知する
Good: フェーズごとに gh stack add した branch で commit し、submit 後に kstack-git の title・body・assignee に直してから URL を通知する
```

なぜ: フェーズごとの PR にすると、user は各 PR でそのフェーズの差分だけを review でき、下の層から順に merge できる。submit の自動の値は kstack-git の形と違い、user が PR 一覧から内容を読めない。

## PR の指摘と CI の失敗を直す

review の指摘と、自分の PR の CI の失敗は、指示を待たずにそのフェーズの branch で直す（`kstack-git` の「失敗したら指示なしに修正・再 push しない」は、この SKILL の PR では置き換える）。作業中のフェーズの差分を持ったまま branch を切り替えず、そのフェーズの PR を出してから対応する。

1. `gh stack checkout <PR URL>` で対象の branch に移り、直して `kstack-git` の「commit の書き方」で commit する
2. `gh stack rebase --upstack` で上の branch に伝え、`gh stack push` で push する。conflict は上の層で解き、`gh stack rebase --continue` で続ける
3. 指摘の PR に何を直したかを返信し、push した commit の CI を監視する。上の層の PR の説明が古くなったら body に追記する

```text
Bad: 指摘を最上段の branch で直す / 直した branch だけ push し、上の層を古い base のままにする
Good: 指摘された PR の branch で直し、--upstack で上の層に伝えてから gh stack push する
```

なぜ: 指摘されたフェーズ以外で直すと、その PR の差分に修正が現れず、user は直ったかを PR で確かめられない。上の層に伝えないと、上の PR に古い差分が混ざる。

## merge

merge は user の明示の指示があるときだけ行う。指示された PR とその下の層のすべての PR で `kstack-git` の「PR を merge する」の手順 1〜3（`gh pr ready`、CI、approve と merge できる状態）を確かめてから、`gh stack merge <指示された PR 番号> --squash --yes`（repo が squash を許さなければ許されている方法）で下の層からまとめて merge する。approve や指摘の解消を merge の許可とみなさない。

なぜ: `gh stack merge` は draft でないことしか事前に確かめず、指定した PR より下の層をすべて一度に merge する。確かめずに実行すると、CI や approve を確かめていない下の層まで default branch に入る。
