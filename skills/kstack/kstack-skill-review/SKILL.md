---
name: kstack-skill-review
description: taiki-kuraishi/skill リポジトリの SKILL（kstack-agents-md、kstack-better-auth、kstack-better-result、kstack-cloudflare-vite-plugin、kstack-code-comment、kstack-drift-review、kstack-drizzle-orm、kstack-gdscript、kstack-git、kstack-github-actions、kstack-handoff、kstack-hono、kstack-interface-first-development、kstack-layerd-architecture、kstack-mise、kstack-monorepo、kstack-nuqs、kstack-playwright、kstack-react、kstack-review-request、kstack-root-driven-development、kstack-tanstack-db、kstack-tanstack-query、kstack-tanstack-router、kstack-terraform、kstack-testing、kstack-typescript、kstack-vite、kstack-vite-plus、kstack-worktree-diff）を読み込み、その規約からズレているコードを指摘するレビュー手順。コードレビュー、diff・PR のレビュー、「SKILL・規約に沿っているか見て」という依頼、実装後の自己レビューで使用すること。
---

# kstack-skill-review

コードを、taiki-kuraishi/skill リポジトリで定義された下記の SKILL の規約と突き合わせてレビューする。指摘の根拠はすべてこれらの規約に置く。根拠が SKILL にあれば、指摘された側は規約を読んで納得でき、合意済みのルールとレビュアーの好みが混ざらない。

- `kstack-agents-md`
- `kstack-better-auth`
- `kstack-better-result`
- `kstack-cloudflare-vite-plugin`
- `kstack-code-comment`
- `kstack-drift-review`
- `kstack-drizzle-orm`
- `kstack-gdscript`
- `kstack-git`
- `kstack-github-actions`
- `kstack-handoff`
- `kstack-hono`
- `kstack-interface-first-development`
- `kstack-layerd-architecture`
- `kstack-mise`
- `kstack-monorepo`
- `kstack-nuqs`
- `kstack-playwright`
- `kstack-react`
- `kstack-review-request`
- `kstack-root-driven-development`
- `kstack-tanstack-db`
- `kstack-tanstack-query`
- `kstack-tanstack-router`
- `kstack-terraform`
- `kstack-testing`
- `kstack-typescript`
- `kstack-vite`
- `kstack-vite-plus`
- `kstack-worktree-diff`

## 手順

1. **レビュー対象を決める** — user がファイルや範囲を指定したらそれに従う。指定がなければ未コミットの変更（`git diff HEAD` と untracked ファイル）、それも無ければ base branch との差分（`git diff <base>...HEAD`）を対象にする。完了条件: 対象ファイルと変更行の一覧が確定している
2. **SKILL を読み込む** — 対象ファイルとの関係を考える前に、上の一覧の `SKILL.md` をすべて読む。どの SKILL が当てはまるかは本文の対象を読まないと決められず（`kstack-code-comment` は言語を問わずすべてのコード・設定に及ぶ）、名前や拡張子から読み飛ばした SKILL は、手順 3 以降の確認から外れて違反が見つからなくなる。依頼が見る観点や比較対象を指定していても、この読み込みは省かず、指定された観点は規約の突き合わせに足して見る。agent に登録された SKILL にあればそれを読み、無ければ `.claude/skills/<name>/SKILL.md`、`.agents/skills/<name>/SKILL.md`、`~/.claude/skills/<name>/SKILL.md` を探す。SKILL.md が別ファイルを参照していれば、それも読む。どこにも見つからない SKILL は報告の「確認済み」に「未導入」として書く。完了条件: 一覧の全 SKILL が「読んだ」か「未導入」のどちらかになっている
3. **適用する規約を選ぶ** — 読んだ各 SKILL の対象（言語、ライブラリ、層、ファイル種別）を対象ファイルと照らし、当てはまる SKILL の規約を見出し単位で抜き出す。当てはまらない SKILL は外した理由を 1 行で残す。完了条件: 読んだ全 SKILL が「適用」か「適用外（理由付き）」のどちらかに分かれている
4. **規約ごとに突き合わせる** — 抜き出した規約と対象ファイルのすべての組を確認する。Bad 例と同じ形の箇所に加え、規約の「なぜ」が守ろうとしているものを壊している箇所も違反とする。変更行だけでなく、変更の影響が及ぶ呼び出し元や同じ class の他 method も読む。完了条件: すべての組に「違反あり / なし」が付いている
5. **報告する** — 下の形式で違反を並べる。コードは書き換えず、user が修正を頼んだときだけ直す

SKILL や対象ファイルが多く、subagent が使える環境なら、手順 3 以降を SKILL 単位で分担してよい。

## 報告の形式

違反はファイル順・行順に並べ、1 件ごとに根拠の SKILL 名と規約の見出しを付ける。

```md
## 違反

- `src/client/judge.ts:42` — [kstack-typescript] else・三項演算子を使わない。早期 return する
  - ズレ: 異常系が else の中にあり、主処理がネストしている
  - 修正案: `if (!res.ok) { return Result.err(...) }` を先に置き、else を外す

## 要確認

- `src/steps/launch.ts:10` — [kstack-layerd-architecture] use case は execute だけを持つ
  - 判断が割れる理由: ...

## 確認済み

- 違反なし: kstack-better-result, kstack-testing
- 適用外: kstack-playwright（ブラウザテストが対象に無い）
```

## 判断の目安

- SKILL 内に例外条件が書かれた規約は、その条件に当てはまれば違反にしない
- 規約の文言から白黒を付けられないものは「要確認」に理由付きで分ける。違反に混ぜると、確実な指摘まで疑われる
- SKILL 同士の規約が食い違う箇所は、どちらかを選ばず両方の規約を示して user に判断を仰ぐ
- 変更と無関係な既存コードの違反は、本編と分けて「既存」の見出しにまとめる。今回の変更で直すべきものと、別途直すものを区別するため
