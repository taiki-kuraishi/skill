---
name: kstack-review-exemption
description: kstack-root-driven-development・kstack-bot-driven-development と一緒に読み込み、taiki-kuraishi/skill の kstack SKILL で書き方が決まっているコードだけのフェーズで user review を省く追加の取り決め。省けるフェーズの条件（変更したファイルがすべてコメント以外の kstack SKILL の対象、今回の変更への gate 前の review の指摘がすべて解消、既存パターンから外れる実装・未決事項・UI の変更が無い）を fresh-context の subagent に判定させ、すべて満たすときに差分と従った規約を対にして示して「review を飛ばしてもいいですか」と user に確かめ、省いてよいと答えたときだけ省くこと、root-driven では Crit の gate を開かずに commit すること、bot-driven では答えを PR の merge の指示として ready にし gh stack merge することを扱う
disable-model-invocation: true
---

# kstack-review-exemption

`kstack-root-driven-development` か `kstack-bot-driven-development` と一緒に読み込んで使う。kstack SKILL に書き方が決まっているコードは、規約との突き合わせを手順 5 の review（`kstack-skill-review`・`kstack-drift-review`・`ponytail-review`）が受け持つので、user が同じことを見直さなくてよい。下の条件を満たすフェーズは、差分とそれが従った規約を示して user に review を省いてよいか確かめ、user が省いてよいと答えたときだけ省く。それ以外は、読み込んだ開発フローのとおり user review に出す。

## user review を省けるフェーズ

次をすべて満たすフェーズだけ、省いてよいかを user に確かめる。満たすかどうかは下の「条件を subagent に判定させる」で判定させ、1 つでも外れたら、確かめずに開発フローのとおり user review に出す。

1. **変更したファイルがすべて kstack SKILL の対象** — 手順 5 の `kstack-skill-review` で、変更したファイルごとに、コメント以外の書き方を定める SKILL が「適用」になっている。`kstack-code-comment` はどのファイルにも適用されるので、それだけのファイル（kstack SKILL の無い言語・設定・manifest など）が 1 つでもあれば外れる
2. **今回の変更への手順 5 の指摘がすべて解消** — 3 つの review が今回の変更に出した違反・要確認・ドリフト・指摘をすべて直し、直さなかった指摘・SKILL 同士の食い違いが残っていない。「既存」に分けられた、今回の変更と無関係な既存の指摘は数えない。直して挙動が変わり得るなら、検証を subagent に出し直して通っている
3. **判断が要る変更が無い** — 合意した目的・対象の範囲内で、開発フローの「既存パターンから外れる実装」に当たる変更と、user にしか決められない未決事項が無い
4. **UI が変わらない** — 見た目・操作が変わるフェーズは外れる。kstack SKILL はコードの書き方を決めるだけで、画面がどう見えるかは決めない

```text
Bad: kstack-typescript の対象の .ts と、kstack-code-comment しか適用されない k8s の manifest を変えたフェーズで、user review を省く
Good: .ts だけを変え、skill-review が kstack-typescript・kstack-testing を「適用」とし、指摘をすべて直したフェーズだけ、省いてよいかを user に確かめる
```

なぜ: user review が守っているもののうち、書き方は kstack SKILL と review subagent が代わりに守れるが、規約の無いファイル・判断・画面の見え方は代わりがいない。1 つでも混ざったフェーズを省くと、user が見るべき変更が見られないまま進む。

## 条件を subagent に判定させる

手順 5 の review の指摘を直し終えたら、その 3 つとは別の fresh-context の read-only subagent（Pi は `reviewer`、Claude Code は `general-purpose` に no-edit を明示）を 1 つ起動し、上の条件 1〜4 を判定させる。`kstack-root-driven-development` の Subagent contract は「subagent には事実と review だけを頼み、判断は root が行う」としているが、この判定はその例外として subagent に決めさせる。依頼には、この SKILL の path、フェーズの目的と対象、変更したファイルと範囲、手順 5 の 3 つの review の報告と、それぞれの指摘をどう直したかを渡す。報告は条件ごとの `満たす / 満たさない` と根拠（ファイル・行、review の報告の該当箇所）にさせる。

すべて「満たす」のときだけ、下の「省いてよいか user に確かめる」に進む。root は判定を「満たさない」から「満たす」へ覆さない。判定の根拠が誤っていると root が考えても、省かずに user review に出し、判定の報告をそのまま `未解決事項`（bot-driven）か user への依頼（root-driven）に添える。判定の後に変更を足したら、そのフェーズは省かずに user review に出す。足した変更は手順 5 の review を通っておらず、判定し直しても条件 2 を確かめられない。

```text
Bad: root が自分で条件を見て省くと決める / 手順 5 で review した subagent に判定も続けて頼む / 「満たさない」の判定を root が覆して省く
Good: 修正を終えた変更・3 つの review の報告・直した内容を新しい subagent に渡し、条件ごとの判定と根拠を受け取って、すべて「満たす」のときだけ user に確かめる
```

なぜ: 変更を書いた root は、自分の変更を省ける側に読みやすい。手順 5 で review した subagent は自分の指摘が直ったかを見る立場で、変更全体を条件に照らす役ではない。書いていない別の subagent が条件ごとに根拠を示せば、user は省いた理由を後から確かめられる。

## 省いてよいか user に確かめる

判定がすべて「満たす」なら、差分と、それが従った kstack SKILL の規約を対にして示し、review を省いてよいかを 1 問で聞く。差分は変更の中身を一言で、規約は SKILL 名と規約の見出しで書き、変更のまとまりごとに 1 行にする。subagent の判定は根拠として添える。

```text
Bad: 条件を満たしたので review を省きました（何に従ったかを書かずに事後報告する）
Good: 差分は「users テーブルの検索を UserRepository の findByEmail に足した」です。kstack-layerd-architecture の「repository は 1 table 1 class、1 query 1 method」と kstack-drizzle-orm の「<規約の見出し>」に書いてあるとおりに実装しました。判定は条件 1〜4 すべて満たすでした（根拠: …）。review を飛ばしてもいいですか？
```

user が省いてよいと答えたら、下の「root-driven-development で省くとき」「bot-driven-development で省くとき」のうち、読み込んだ開発フローの節で進める。省かないと答えたとき、別の指摘を返したときは、開発フローのとおり user review に出す（指摘があれば同じフェーズで直す）。

なぜ: 条件を満たしても、user が見たい変更かどうかは user にしか分からない。差分と規約を対にして見せれば、user は差分を読まずに「その規約に任せてよいか」だけで決められ、review より短い時間で済む。

## root-driven-development で省くとき

省いてよいかを chat で聞いて止まり、答えを受け取る。省いてよいと答えたら、手順 6 の Crit の gate（`kstack-review-request`）を開かず、手順 6 の最後と同じく commit する。branch が default branch なら `skill://kstack-git` の「PR の作り方」の手順 1 と同じ形で topic branch を切り、現在のフェーズの変更だけを stage して「commit の書き方」で commit する。commit したら commit を通知し、手順 3 に戻る。push・PR・merge は、これまでどおり別の明示の指示に従う。

## bot-driven-development で省くとき

フェーズの PR は「フェーズを stack に積む」のとおり draft で出し、body の `確認方法` に、上の「省いてよいか user に確かめる」の差分と規約の対、subagent の条件 1〜4 の判定と根拠を書く。依頼元に PR の URL と同じ問いを送り、答えを待たずに次のフェーズへ進む（`kstack-bot-driven-development` のとおり）。bot-driven では答えが merge につながるので、問いは「省いてよければ ready にして merge します。review を飛ばしてもいいですか？」のように、省いた後に何をするかまで書く。

user が省いてよいと答えたら、その答えをこの PR の merge の指示とみなす（答えが全フェーズを終えた後に届いても同じ）。CI が通っていれば `gh pr ready` で ready にし、`kstack-git` の「PR を merge する」の手順 2・3 で CI・approve・merge できる状態を確かめ、手順 4 の `gh pr merge` の代わりに `gh stack merge <この PR> --squash --yes`（repo が squash を許さなければ許されている方法）で merge する。

- stack の下の層に user review を待つ PR があるうちは merge しない。下の層が merge されてから merge する
- repo が approve を求めるなら merge せず、PR の URL と `reviewDecision` を通知する。branch protection は迂回しない
- 答えが無いうち、省かないと答えたときは、これまでどおり draft のまま user の review と merge の指示を待つ

```text
Bad: user に聞かずに ready にして merge する / 下の層が review 待ちなのに gh stack merge で一緒に merge する
Good: 差分と規約の対を PR と通知で示して聞き、省いてよいと答えた PR だけを、下の層が merge されてから merge する
```

なぜ: bot-driven では PR が user review の場で、答えを待って止まると作業がそこで止まる。問いを PR に残して先に進めば、user は都合の良いときに答えられる。`gh stack merge` は指定した PR より下の層もすべて merge するので、review 待ちの層が下にあると、それまで user の確認なしに入る。
