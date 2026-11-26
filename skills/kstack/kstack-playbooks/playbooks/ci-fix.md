# CI の失敗を直す

**持つもの: 落ちた check が通るまで。**

使う場面: PR か commit の CI が落ちた。依存を更新する PR（Renovate など）の失敗も含む。直す依頼を受けているので、`kstack-git` の「push した commit の CI を完了まで監視する」にある「指示なしに修正・再 push しない」には当たらない。

1. 落ちた run と job を特定する（`gh run list --commit <SHA>`、`gh run view <run-id> --log-failed`）。ログは subagent に読ませ、落ちた step・エラー・関係するファイルだけを受け取る。完了条件: 落ちた step とエラー文がある
2. 原因を分ける
   - default branch でも同じ失敗が出ている → 直さず、同じ失敗が出た run を報告して終える
   - network や runner の一時的な失敗に見える → 1 回だけ再実行する。また落ちたら、この変更の失敗として次へ進む
   - 依存を更新した PR → 更新した依存の変更点（release note、型や API の変更）を読んでから次へ進む
   - それ以外 → 次へ進む
3. 同じ失敗を手元で再現する。完了条件: CI と同じエラーが手元で出ている
4. その PR の branch で原因を直す。stack の PR は `kstack-bot-driven-development` の「PR の指摘と CI の失敗を直す」で直す。テストの期待値を変える修正と、テストや check を skip・削除する修正は、期待する動きの判断なので、`kstack-playbooks` の「playbook の回し方」の手順 2 で聞く
5. push し、`kstack-git` の「push した commit の CI を完了まで監視する」で通るまで見る。また落ちたら手順 1 に戻る

```text
Bad: 落ちたテストを skip して緑にする / 通るまで再実行を繰り返す
Good: 落ちた理由を手元で再現して直し、同じ check が通った run の URL を示す
```

なぜ: skip や再実行で緑にすると、壊れた動きが残ったまま merge できる状態になる。default branch でも落ちる失敗をその PR で直すと、PR の範囲が依頼と関係ない変更で広がる。

**報告**: 落ちた原因、直したこと、通った run の URL。default branch でも落ちる失敗なら、その run の URL。
