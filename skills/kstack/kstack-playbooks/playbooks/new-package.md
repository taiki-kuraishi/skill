# monorepo に package・app を足す

**持つもの: 新しい package の器（README の責務、export の入口、task）が動くこと。中身の実装は持たない。**

使う場面: `packages/*` や `apps/*` を新しく作る。中身は、そのあと API や DB スキーマの変更など、中身に合う playbook で回す。既存の package の責務を変える依頼は対象外で、`kstack-monorepo` のとおり user に案を出す。新しい package を作ると root の workspaces・lockfile・`config_roots` も変わるが、この playbook ではそれらを `kstack-worktree-diff` の「1 フェーズで変更する package は 1 つ」の数に入れない。

1. 責務を決める。既存の package の README の責務 section と照らし、新しい package の名前と、実装すること・実装しないことを 1 行ずつ書く。完了条件: 各行に出典か user の答えがある
2. 承認を取る。新しい package は `kstack-root-driven-development` の「既存パターンから外れる実装」に当たるので、既存の package に置く案と並べ、代償を 1 行ずつ添えて聞く。bot も聞いて止まる。完了条件: user の承認がある
3. 器を作る。`package.json`、`src/index.ts`（外に出す名前はここにだけ並べる。`kstack-typescript`）、兄弟の package と同じ tsconfig を作り、root の workspaces と lockfile への登録も同じ commit にする
4. README を書く（`kstack-readme`）。AGENTS.md は兄弟の package にあるときだけ、`kstack-agents-md` のとおり規約だけを書いて作る
5. task を足す。package に閉じる task は、`kstack-mise-tasks` の「1 つの package・app に閉じるタスクは、そのディレクトリの mise.toml に書く」に従う。完了条件: `mise tasks --all` に `//<path>:<task>` が出る
6. Worker の app なら、`kstack-cloudflare-vite-plugin` と `kstack-vite` に従って build を組む
7. 確かめる。install・型検査・build・lint を subagent に流させ、他の package から import できることも確かめる。repo の CI が新しい package を拾わないときは、続けて CI・git hook・mise task の playbook を回す

```text
Bad: 承認を取らずに packages/utils を作り、責務 section に「汎用の処理」と書く
Good: 責務を名前にした package の案を既存に置く案と並べて聞き、承認の後に「実装しないこと」まで書く
```

なぜ: package は一度できると、何でも入る置き場になりやすい。作る前に責務と入れないものを決めて承認を取れば、相乗りを README で止められる。

**報告**: package の名前と責務、承認の記録、作ったファイル、task の一覧、流した検査の出力。
