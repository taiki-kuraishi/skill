---
name: kstack-review-exemption
description: kstack-root-driven-development・kstack-bot-driven-development と一緒に読み込み、taiki-kuraishi/skill の kstack SKILL で書き方が決まっているコードだけのフェーズで user review を省く追加の取り決め。省けるフェーズの条件（変更したファイルがすべてコメント以外の kstack SKILL の対象、今回の変更への gate 前の review の指摘がすべて解消、既存パターンから外れる実装・未決事項・UI の変更が無い）と、root-driven では Crit の gate を省いて commit すること、bot-driven では PR を ready にして CI が通ったら gh stack merge することを扱う
disable-model-invocation: true
---

# kstack-review-exemption

`kstack-root-driven-development` か `kstack-bot-driven-development` と一緒に読み込んで使う。kstack SKILL に書き方が決まっているコードは、規約との突き合わせを手順 5 の review（`kstack-skill-review`・`kstack-drift-review`・`ponytail-review`）が受け持つので、user が同じことを見直さなくてよい。この SKILL を読み込んだことを、下の条件を満たすフェーズについて、user review を省く user の指示として扱う。条件を満たさないフェーズは、読み込んだ開発フローのとおり user review に出す。

## user review を省けるフェーズ

次をすべて満たすフェーズだけ省く。1 つでも外れたら、開発フローのとおり user review に出す。

1. **変更したファイルがすべて kstack SKILL の対象** — 手順 5 の `kstack-skill-review` で、変更したファイルごとに、コメント以外の書き方を定める SKILL が「適用」になっている。`kstack-code-comment` はどのファイルにも適用されるので、それだけのファイル（kstack SKILL の無い言語・設定・manifest など）が 1 つでもあれば外れる
2. **今回の変更への手順 5 の指摘がすべて解消** — 3 つの review が今回の変更に出した違反・要確認・ドリフト・指摘をすべて直し、直さなかった指摘・SKILL 同士の食い違いが残っていない。「既存」に分けられた、今回の変更と無関係な既存の指摘は数えない。直して挙動が変わり得るなら、検証を subagent に出し直して通っている
3. **判断が要る変更が無い** — 合意した目的・対象の範囲内で、開発フローの「既存パターンから外れる実装」に当たる変更と、user にしか決められない未決事項が無い
4. **UI が変わらない** — 見た目・操作が変わるフェーズは外れる。kstack SKILL はコードの書き方を決めるだけで、画面がどう見えるかは決めない

```text
Bad: kstack-typescript の対象の .ts と、kstack-code-comment しか適用されない k8s の manifest を変えたフェーズで、user review を省く
Good: .ts だけを変え、skill-review が kstack-typescript・kstack-testing を「適用」とし、指摘をすべて直したフェーズだけ省く
```

なぜ: user review が守っているもののうち、書き方は kstack SKILL と review subagent が代わりに守れるが、規約の無いファイル・判断・画面の見え方は代わりがいない。1 つでも混ざったフェーズを省くと、user が見るべき変更が見られないまま進む。

## root-driven-development で省くとき

手順 6 の Crit の gate（`kstack-review-request`）を開かず、手順 5 の修正の後、手順 6 の最後と同じく commit する。branch が default branch なら `skill://kstack-git` の「PR の作り方」の手順 1 と同じ形で topic branch を切り、現在のフェーズの変更だけを stage して「commit の書き方」で commit する。commit したら、user に `user review を省いたフェーズ / commit / 変更ファイル / 適用した kstack SKILL / 手順 5 で直した指摘` を通知し、承認を待たずに手順 3 に戻る。push・PR・merge は、これまでどおり別の明示の指示に従う。

## bot-driven-development で省くとき

フェーズの PR は「フェーズを stack に積む」のとおり出し、body の `確認方法` に「user review 不要（kstack-review-exemption）」と、上の条件 1〜4 を満たした根拠（適用した kstack SKILL、直した指摘）を書く。CI が通ったら `gh pr ready` で ready にし、`kstack-git` の「PR を merge する」の手順 2・3 で CI・approve・merge できる状態を確かめ、手順 4 の `gh pr merge` の代わりに `gh stack merge <この PR> --squash --yes`（repo が squash を許さなければ許されている方法）で merge する。この SKILL を読み込んだことを、省けるフェーズの PR の merge の指示とみなす。

- stack の下の層に user review を待つ PR があるうちは merge しない。下の層が merge されてから merge する
- repo が approve を求めるなら merge せず、PR の URL と `reviewDecision` を通知する。branch protection は迂回しない
- 省けないフェーズの PR は、これまでどおり draft のまま user の review と merge の指示を待つ

```text
Bad: 省けるフェーズの PR を draft のまま積み、user の merge の指示を待つ / 下の層が review 待ちなのに gh stack merge で一緒に merge する
Good: 省けるフェーズは CI が通ったら ready にして merge し、下の層に review 待ちがあれば、それが merge されてから merge する
```

なぜ: bot-driven では PR が user review の場なので、merge を待つ限り user review は省けない。`gh stack merge` は指定した PR より下の層もすべて merge するので、review 待ちの層が下にあると、それまで user の確認なしに入る。
