# 画面を作る・直す

**持つもの: 1 つの画面が、user の live review を通るまで。**

使う場面: React の画面（route と view）を足す、または表示や操作を変える。`kstack-worktree-diff` の「UI の機能変更は画面ごとにフェーズを分ける」に従い、画面ごとにこの playbook を回す。画面が使う endpoint が無ければ API の playbook を、schema の変更が要れば DB スキーマの変更の playbook を先に回す。期待する動きが決まっている表示の不具合はバグ修正で扱う。

1. 画面を決める。次の項目を書き出し、依頼・既存の画面・文書に無いものは `kstack-playbooks` の「playbook の回し方」の手順 2 で聞く。見た目の正解はどの SKILL にも無いので、見た目の出典が無ければ必ず聞く。完了条件: 各項目に出典か user の答えがある
   - route の path
   - 操作ごとの URL の変わり方
   - loading・empty・error のときに出すもの
   - URL に持つ state（`kstack-nuqs` の「URL を共有して同じ表示になる state は URL に持つ」）
   - 見た目の出典（デザイン、似た既存の画面）
2. route を足す（`kstack-tanstack-router`）。完了条件: 手順 1 の path を開くと route が描画される
3. データの hook を用意する。API を呼ぶ hook は、`kstack-tanstack-query` のとおり app ではなく hooks の package に置く（`kstack-react` の例が app の hook から `useQuery` を呼んでいても、`kstack-tanstack-query` に従う）。client は `kstack-hono` の型付き client を使い、live query は `kstack-tanstack-db` に従う。完了条件: app の hook に `queryKey`・`queryFn` が無い
4. view と hook を書く（`kstack-react`）
5. URL の state をつなぐ（`kstack-nuqs`）
6. VRT と E2E を分けて足す（`kstack-playwright`）。完了条件: 手順 1 の表示状態ごとに VRT が、URL の変化ごとに E2E がある
7. 実物で確かめる。repo の mise task か package.json の script で dev server を起動し、手順 1 の path を開いて表示を見る。起動できなければ、そこで止まって聞く。テストは subagent に流させる
8. user review に出す。画面の変更は `kstack-review-exemption` の「UI が変わらない」を満たさないので、user review を省かない。bot 以外は `kstack-review-request` の「live review で起動する」で依頼する。bot は画面ごとに draft PR を出して止まり、次の画面へは user の承認の後に進む。`kstack-bot-driven-development` の「答えを待たずに次のフェーズへ進む」より、この playbook を優先する

```text
Bad: 似た画面を真似て余白と文言を決め、VRT が通ったので完了と報告する
Good: 見た目の出典を聞いてから書き、dev server で開いた画面を live review に出す
```

なぜ: 画面の正しさは、コードの規約だけでは決まらない。見た目の出典を先にそろえ、live review を必ず通せば、agent が決めた見た目のまま入ることが無い。

**報告**: 画面の path、手順 1 の項目と出典、変えたファイル、通ったテストの出力、review の URL。
