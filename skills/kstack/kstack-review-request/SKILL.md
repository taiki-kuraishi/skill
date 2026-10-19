---
name: kstack-review-request
description: Crit で実装・修正したコードや PR、動く画面（dev server の live review）を user にレビュー依頼・再依頼し、承認を受け取る共通手順。呼び出し側とツール固有手順を分離し、root-driven-development・interface-first-development・handoff の user review gate で使用する。agent によるコード・文書レビューでは規約として読むだけで、レビューは開始しない。
---

# kstack-review-request

user review の窓口を 1 session に置き、Crit の起動から指摘の返信・再レビュー・承認まで同じ窓口で扱う。この SKILL を使う開発フローの gate は、Crit で review する取り決めとして扱う。Crit の操作手順は自分で書かず、`skill://crit`（review の起動・結果の読み方・再レビューの流れ）と `skill://crit-cli`（コメント JSON の読み方・返信・`--session` の指定）を最初に読んで従う。この SKILL には、それらに無い窓口・公開 URL・session 管理の取り決めだけを置く。

`skill://crit` は「user が Crit を明示したときだけ使う」としているが、この SKILL の gate は Crit を使う取り決めなので、明示の依頼として扱う。両 SKILL と食い違う点は、この SKILL を優先する。

## 依頼する session

| フロー                                                             | user への依頼と Crit の管理                       |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| root-driven-development                                            | root                                              |
| interface-first-development / handoff                              | root。起動方式によらず子の worktree を cwd にする |
| 単独で user から実装を依頼された session（親 root の配下ではない） | その session                                      |

root から実装を委任された子は、完了条件の確認結果と変更内容（PR があれば URL）を root に報告して待つ。user への review 依頼、Crit の起動・返信・再開・停止は root が行う。root の連絡先が欠けているなら review を始めず、呼び出し元で連絡経路を確定する。

```text
Bad: root → 子「user に review を頼んで」→ root と子が別々の Crit を起動
Good: 子 → root「差分と検証結果」→ root → user「Crit の URL」
```

なぜ: 窓口が分かれると、user はどちらに指摘するか迷い、別 session の daemon を止める事故が起きる。子はこの SKILL を読まないので、呼び出し元の引き継ぎ prompt にも報告先を書く。

## 呼び出し側との境界

呼び出し元は、対象の cwd・未コミット差分または PR の URL・検証結果・未解決事項を渡し、承認・指摘・中断の結果を受け取る。ツール名・コマンド・承認の判定方法は、この SKILL と Crit の SKILL に集約する。

```text
Bad: 開発フローにレビュー用ツールの起動コマンドや完了ボタン名を書く
Good: 開発フローは kstack-review-request に対象と証拠を渡し、その承認結果を待つ
```

なぜ: レビュー方式の変更で複数の開発フローを書き換えると、古い手順が残りやすい。

## 手順

1. **対象を固定する** — cwd、フェーズ、変更ファイル、検証結果、未解決事項をそろえる。承認済みのフェーズは呼び出し元が commit しているので、未コミット差分の review は下の「公開 URL で起動する」のとおり `HEAD` を基点にする。開始前の差分が同じ review に含まれるなら、今回見てほしい範囲と分けて示す
2. **session を選ぶ** — 同じ対象で自分が管理する session があれば `--session <id>` で再利用する。所有者や対象が不明な session は、停止や重複起動の前に窓口を確認する
3. **起動して依頼する** — 下の「公開 URL で起動する」で起動し、`できるようになったこと / 変更ファイル / 検証と証拠 / 未解決事項` と `REVIEW_URL` を書いて、コメントを書き Finish Review を押すよう頼む
4. **結果を受け取る** — review 待ちの todo を block にして turn を終え、job の終了を待つ。結果は `skill://crit` の手順で読む。Finish Review 以外の終了は中断として user に報告し、再開の意思を確認する。失敗・中断・結果未受領は承認ではない
5. **指摘に応える** — `approved: false` なら、未解決の指摘をすべて呼び出し元のフローで修正・再検証し、`skill://crit-cli` に従って各指摘へ `--session <id> --reply-to` で返信する（`--author 'root'`）。子が実装するフローでは、root が指摘を子に渡し、対応結果と返信文を受け取って返信する。自分で resolve しない
6. **再レビューする** — 同じ session を background job で再開し、`REVIEW_URL` を再掲して手順 4 に戻る
7. **承認して閉じる** — `approved: true` を承認として呼び出し元へ返す。daemon が残っていれば、自分が起動した session の PID だけを止める

## 公開 URL で起動する

user は別の端末から review するので、user に渡す URL は必ず公開ホストの URL にする。公開ホストは環境変数 `CRIT_PUBLIC_URL`（port の無い base URL）から読み、ホスト名を SKILL に書かない。設定が無いときだけ loopback の URL を使う。公開への同意は `CRIT_ALLOW_UNAUTHENTICATED_NETWORK` を継承し、未許可なら Crit の拒否を user に示して勝手に許可しない。

Crit は Finish Review まで終わらないので、`skill://crit` の foreground 実行ではなく、出力と終了を受け取れる background job で起動する（omp なら `async: true`・`timeout: 0`）。job の出力は終了まで届かないため、URL は Crit の出力から拾わず、起動前に同期で決める。

```bash
PORT=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
REVIEW_URL="${CRIT_PUBLIC_URL:-http://127.0.0.1}"
REVIEW_URL="${REVIEW_URL%/}:$PORT"
echo "PORT=$PORT REVIEW_URL=$REVIEW_URL"
```

控えた値を埋めて background job で起動し、`crit status --json` の `sessions` に `PORT` の行が出たら、その `id`・`pid` を記録してから user に `REVIEW_URL` を書く。

```bash
network_args=(--host 127.0.0.1 --no-open -p <PORT>)
[ -n "${CRIT_PUBLIC_URL:-}" ] && network_args+=(--public-url "<REVIEW_URL>")
crit "${network_args[@]}" <対象の引数>
```

`<対象の引数>` は、未コミット差分を review するとき `--base-branch HEAD` にする。引数なしの `crit` は topic branch で default branch との branch diff を既定にするので、承認後に commit した前のフェーズの変更まで review に出る。`HEAD` を基点にすると、未コミットの今回のフェーズだけが出る。PR を review するときは呼び出し元から受け取った PR の対象を渡す。

```text
Bad: user に http://127.0.0.1:<port> や localhost の URL を渡す / job の出力から URL を拾おうとして待つ / --host を Tailscale の IP にする
Good: CRIT_PUBLIC_URL と PORT から REVIEW_URL を決め、--public-url に同じ値を渡し、起動を確認してから REVIEW_URL を書く
```

なぜ: loopback の URL は user の端末から開けない。`--public-url` は Host の許可と表示 URL を変えるだけで port の転送は作らないため、listen は loopback のまま既存の転送経路に任せる。port を先に決めると、URL を事前に確定でき、複数の review が同時に動いても衝突しない。

## live review で起動する

呼び出し元から dev server の URL（`localhost:<port>`）を受け取ったら、上と同じ `PORT`・`REVIEW_URL`・background job で、`crit live "${network_args[@]}" <url>` として起動する（option は `live` の後に置く）。この SKILL の「手順」の 3〜7 はコードの review と同じで、指摘は DOM 要素に pin される。返信はコードの指摘と同じく `--reply-to <id>` で行い、`--selector` は新しく pin を付けるときだけ使う。修正を見せ直す前に、dev server が更新後のコードで動いていることを確かめる。

```text
Bad: DOM の指摘への返信に --selector を付け、別の新しい指摘を作る / review 中に dev server を止める
Good: --session <ID> --reply-to <id> で返信し、dev server を動かしたまま次の round を開く
```

なぜ: `--selector` は新規の pin を作るので、返信のつもりが user の指摘と切り離された指摘になる。dev server が止まると、user は修正後の画面を見直せない。

## session を取り違えない

返信・コメントの読み出し・再開・停止は、記録した session ID と PID で行う。承認は返信を書いたことではなく、次の Finish Review の結果で決める。

```text
Bad: crit stop --all / cwd だけを頼りに crit stop / 返信後に次フェーズへ進む
Good: --session <記録した ID> で次の round を待ち、approved: true の後に自分の daemon PID だけを停止
```

なぜ: 同じ cwd と branch に別の review があると、cwd だけの操作は別 session を選びうる。停止を承認の代わりにすると、user が未確認の変更まで進む。
