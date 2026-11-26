# CI・git hook・mise task を変える

**持つもの: 設定の変更が、手元と CI の実際の run で期待どおりに動くこと。**

使う場面: `.github/workflows`・composite action・lefthook・mise task・Vite+ の `run.tasks` を変えて、CI や hook の動きを変える。既に落ちている CI を直すのは CI の失敗の playbook、既存の設定を規約に合わせるだけなら規約・文書のずれの playbook で扱う。

1. 変えるものを決める。「どの検査を、どこで（mise task・lefthook・CI）、何のために」を 1 行ずつ書き、同じコマンドの重なりと、使われていない task・job も探す。検査を弱める変更（job や step を消す、`continue-on-error` を付ける、lint を CI から外す）と、required checks・ruleset の変更は、書く前に聞く。完了条件: 変える・消すファイルの一覧ができている
2. コマンドの正本を 1 つに決める（mise task か Vite+ の `run.tasks`。repo の既存に合わせる）。hook と CI には同じ生コマンドを書く（`kstack-lefthook` の「job は mise タスクを呼ばず、対応するタスクと同じ生コマンドを書く」）
3. mise・lefthook・CI を、それぞれの規約で変える（`kstack-mise-tasks`、`kstack-mise-actions`、`kstack-lefthook`、`kstack-github-actions`、`kstack-vite-plus`）。cache の restore・save は、`kstack-github-actions` のとおり composite action に切り出す。完了条件: `mise tasks --all` に新しい入口が出て、`lefthook validate` が通る
4. 手元で動かす。task は `mise run`、hook は `lefthook run pre-commit` で流す。完了条件: 期待した出力が出ている
5. push して CI の run を見る。新しい設定で動いた run の結果と URL を受け取る。落ちたら CI の失敗の playbook に切り替える。完了条件: 変えた job が期待どおりに動いた run がある

```text
Bad: workflow の YAML を書き、手元の lint が通ったので完了と報告する
Good: push して、変えた job が実際の run で動いたことを run の URL で示す
```

なぜ: CI の設定は、GitHub の上で動かすまで正しいか分からない。検査を弱める変更は気づかれずに入りやすいので、書く前に聞く。

**報告**: 変えた検査と理由、消したもの、手元の出力、CI の run の URL。
