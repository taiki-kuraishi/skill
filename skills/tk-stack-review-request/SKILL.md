---
name: tk-stack-review-request
description: Crit で実装・修正したコードや PR を user にレビュー依頼・再依頼し、承認を受け取る共通手順。呼び出し側とツール固有手順を分離し、root-driven-development・interface-first-development・handoff の user review gate で使用する。agent によるコード・文書レビューでは規約として読むだけで、レビューは開始しない。
---

# tk-stack-review-request

user review の窓口を 1 session に置き、Crit の起動から指摘の返信・再レビュー・承認まで同じ窓口で扱う。この SKILL を使う開発フローの gate は、Crit で review する取り決めとして扱う。

## 依頼する session

| フロー                                                             | user への依頼と Crit の管理                       |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| root-driven-development                                            | root                                              |
| interface-first-development / handoff                              | root。起動方式によらず子の worktree を cwd にする |
| 単独で user から実装を依頼された session（親 root の配下ではない） | その session                                      |

root から実装を委任された子は、起動方式にかかわらず、完了条件の確認結果と変更内容（PR があれば URL）を root に報告して待つ。user への review 依頼、Crit の起動・返信・再開・停止は root が行う。root の連絡先が欠けているなら review を始めず、呼び出し元で連絡経路を確定する。user が子の pane で review を頼んだ場合も、root に連絡して窓口をそろえる。

```text
Bad: root → 子「user に review を頼んで」→ root と子が別々の Crit を起動
Good: 子 → root「PR と検証結果」→ root → user「Crit の URL」
```

なぜ: 窓口が分かれると、user はどちらに指摘するか迷い、別 session の daemon を止める事故が起きる。子はこの SKILL を読まないので、呼び出し元の引き継ぎ prompt にも報告先を書く。

## 呼び出し側との境界

呼び出し元は、対象の cwd・未コミット差分または PR の URL・検証結果・未解決事項を渡し、承認・指摘・中断の結果を受け取る。レビュー窓口と次フェーズへ進む条件は呼び出し元が持ち、ツール名・コマンド・設定・画面操作・承認の判定方法はこの SKILL に集約する。

```text
Bad: 開発フローにレビュー用ツールの起動コマンドや完了ボタン名を書く
Good: 開発フローは tk-stack-review-request に対象と証拠を渡し、その承認結果を待つ
```

なぜ: レビュー方式の変更で複数の開発フローを書き換えると、古い手順が残りやすい。窓口と進行条件は維持し、方式だけを 1 か所で差し替えられるようにする。

## 手順

1. **対象を固定する** — cwd、フェーズ、変更ファイル、検証結果、未解決事項をそろえる。未コミット差分は `review_args=()`、PR は `review_args=(--pr "$PR_URL")`、指定ファイルは `review_args=("$FILE")` とする。開始前や承認済みの差分が同じ review に含まれるなら、今回見てほしい範囲と分けて示す。完了条件: user が見る対象と、今回の承認範囲が決まっている
2. **session を選ぶ** — 対象の cwd で `crit status --json` の `sessions` を読む。複数あると `daemon.running: false` になるため、その値だけで session が無いとは判断しない。同じ対象の自分が管理する session は `--session <id>` で再利用し、新規起動しない。所有者や対象が不明な session は、停止や重複起動の前に窓口を確認する。新規起動では下の「起動」を使う。完了条件: 対象ごとに管理する session が 1 つに決まっている
3. **起動して依頼する** — Crit は Finish Review まで待つ CLI のまま、出力と終了を受け取れる tool の background job で実行する（omp なら `async: true`・`timeout: 0`）。起動出力の URL・session ID と、`crit status --json` の `sessions` でその ID に一致する行の `port`・`pid` を控える。`できるようになったこと / 変更ファイル / 検証と証拠 / 未解決事項` と URL を示し、「コメントを書き、Finish Review を押してください」と頼む。完了条件: URL と承認対象を user に渡し、待っている job と session を記録した
4. **結果を受け取る** — review 待ちの todo を block にし、turn を終える。同じ対象の変更や次フェーズには進まず、job の終了を待つ。root は別の子からの message には応えられる。終了後に stdout の指摘と stderr の `approved` を読む。Finish Review 以外の終了や、指摘も再開コマンドも無い `approved: false` は中断として user に報告し、修正ループには入らず再開の意思を確認する。再開する場合だけ記録した ID で `crit --session <id>` を起動して手順 4 で待つ。失敗・中断・結果未受領は承認ではない。完了条件: Finish Review の結果、または中断を受領した
5. **指摘に応える** — `approved: false` なら、すべての未解決指摘を呼び出し元のフローで修正・再検証する。`quote` があれば選択範囲に絞り、`anchor` で位置を探す。file・review 全体の指摘は `body` と対象の差分から扱う。`drifted` があれば古い行番号で直さない。子が実装するフローでは、root が指摘の ID・本文・quote・anchor・drifted・既存の返信を子に送り、子から対応結果と返信文を受け取る。root が `crit comment --session <id> --reply-to <comment-id> --author 'root' '<対応内容>'` で返信する。自分で comment を resolve しない。完了条件: 各指摘に対応結果か、直さない理由・要確認を返信した
6. **再レビューする** — 再開前の `http://127.0.0.1:<port>/api/session` の `review_round` を控え、stdout に示された再開コマンド（`crit --session <id>`）を同じ session の background job で実行する。接続メッセージだけでは round が更新されていないことがあるため、`review_round` が進んだことを確認してから修正後の検証結果と URL を示し、手順 4 に戻る。完了条件: 修正後の状態が次の round に渡った
7. **承認して閉じる** — Finish Review の `approved: true`（未解決コメント 0 件）を、示した対象の承認として呼び出し元へ返す。Git 操作は呼び出し元で合意した権限に従う。daemon が残っていれば、対象の cwd で `crit status --json` を読み、自分が起動した session の ID・PID・port が `sessions` の行と記録で一致し、そのプロセスが自分の Crit daemon であることを確認して `kill "$PID"` でその PID だけを停止する。再利用した他 session の daemon や、既に終了した PID は止めない。完了条件: 承認結果を反映し、自分の review の後始末だけを終えた

## 起動

公開ホストは dotfiles の `CRIT_PUBLIC_URL`（port・path のない base URL）から読む。ホスト名を SKILL に埋め込まない。設定があれば空き port を選び、port 付きの `--public-url` を渡す。公開への同意は既存の `CRIT_ALLOW_UNAUTHENTICATED_NETWORK` を継承する。未許可なら Crit の拒否を user に示し、勝手に許可しない。

```bash
network_args=(--host 127.0.0.1 --no-open)
if [ -n "${CRIT_PUBLIC_URL:-}" ]; then
  PORT=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
  network_args+=(-p "$PORT" --public-url "${CRIT_PUBLIC_URL%/}:$PORT")
fi
crit "${network_args[@]}" "${review_args[@]}"
```

`--public-url` は許可する Host と表示 URL を変えるが、port の転送は作らない。既存の転送経路を使い、listen host は loopback のままにする。Crit は認証を持たず、到達できる人は review を読み、コメントを書ける。port の競合で起動に失敗したら、空き port を選び直す。

```text
Bad: localhost の URL の文字列だけを公開ホストに置き換えて user に渡す
Good: --public-url に実際の公開ホストと port を渡し、Crit が出した URL を渡す
```

なぜ: URL の文字列だけを変えても Crit の Host 制限は変わらない。port を固定しないのは、複数の子の review が同時に動くため。

## session を取り違えない

返信・コメントの読み出し・再開は、記録した session ID を指定する。承認は返信を書いたことではなく、次の Finish Review の結果で決める。

```text
Bad: crit stop --all / cwd だけを頼りに crit stop / 返信後に次フェーズへ進む
Good: --session <記録した ID> で次の round を待ち、approved: true の後に自分の daemon PID だけを停止
```

なぜ: 同じ cwd と branch に別の review があると、cwd だけの操作は別 session を選びうる。停止や強制 resolve を承認の代わりにすると、user が未確認の変更まで進む。
