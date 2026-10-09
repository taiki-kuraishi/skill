# manual-handoff

`HERDR_ENV` が 1 でないとき（herdr の外）の `kstack-interface-first-development` の引き継ぎ。root は repo 本体の checkout の default branch のまま動き、子は user が 1 回だけ手で起動する。起動と prompt の貼り付け以外は user の作業にせず、以後の質問・報告・review は intercom で root が窓口を持つ。

## 前提を確かめる

1. **root の位置** — `git rev-parse --show-toplevel` が `git worktree list` の 1 行目の path で、`git branch --show-current` が default branch。違えば、repo 本体の checkout で起動し直すよう user に伝えて止まる
2. **intercom** — `intercom({ action: "status" })` が `Connected: Yes`。root は status の `Session ID`（子からの宛先）を控える。`intercom({ action: "list" })` で子の一覧と状態を読む
3. **足りなければ止まる** — どちらか欠けたら、何が足りないかを user に伝えて止まる。intercom plugin が無ければ、その導入と omp の再起動を伝える。子が user に直接聞く運用や、user が pane の文面を運ぶ運用に黙って切り替えない

完了条件: toplevel・default branch・root の `Session ID` がそろい、intercom が `Connected`

```text
Bad: intercom が無いので、user が 2 つの pane の文面を運ぶ運用に切り替える
Good: 何が足りないかを user に伝えて止まり、intercom がつながるまで子を渡さない
```

なぜ: 窓口の途中で経路を変えると、root はつなぎ目を直せず、統合の証拠も確認できない。user の作業は子の起動と prompt の貼り付けだけに保つ。

## フェーズを渡す

ifd が今回の回として合意したフェーズだけを、1 フェーズ 1 worktree で渡す。前提フェーズはすべて default branch に統合済みとする。後の仕事のフェーズと設計は、今回の統合後に ifd の手順 2 で決める。

1. **worktree を切る** — `wt -C <root の checkout> switch --create ho/<feature>/<task> --base <default branch> --no-cd --format json`。`<task>` は handoff と同じ命名で、フェーズなら `p<N>-<名前>`。base は remote ではなく root の checkout の default branch を使う。stdout の `.path` を控える。完了条件: 渡すフェーズぶんの worktree と `.path` がそろっている
2. **prompt を作る** — ifd の「引き継ぎ prompt」に作業場所・branch・root の full Session ID を埋める。子の連絡・質問・完了報告・review の取り決めはその prompt に集約し、手動経路用の別契約を重ねない。完了条件: prompt だけで子が質問先と作業場所を決められる
3. **user に渡す** — user に cwd（`<worktree の path>`）と prompt を示し、そこで omp を起動して prompt を貼るよう 1 回だけ頼む。以後の pane の見回しは user に頼まない。完了条件: user が起動に必要な 2 つを持っている
4. **todo に記録する** — 1 フェーズ 1 項目で、フェーズ名・worktree の path・branch・子の `Session ID` を書く。`Session ID` は起動の報告で入る。完了条件: todo から worktree と子を引ける

## 子の報告を待つ

子の message は intercom で届く。root は渡したら終わりにしない。待ちの todo を block にして turn を終え、message が届くたびに答えて調整を続ける。

- **起動の報告** — 子の `Session ID` を todo の項目に書き、`intercom({ action: "list" })` で子の状態を見られるようにする
- **質問** — prompt・user と決めたこと・repo から決まることは `intercom({ action: "reply", message })` で答える。複数の ask があるなら `pending` で sender を確かめ、`to` も指定する。user にしか決められないことは root の ask tool で user に聞いてから reply する。決まったことは、後から渡す prompt にも足す
- **設計の変更** — つなぎ目が変わったら root が決め直し、影響する子すべてに `send` で送り、todo と案を更新する
- **完了の報告** — 完了条件ごとの確認結果があるか見る。欠けたら `send` で確かめさせる。そろったら review へ進む
- **動きが見えないとき** — 報告が無いまま進まない子には `send` で状況の報告を求めて待つ

## user review

完了の報告がそろったフェーズだけ、root が `skill://kstack-review-request` に従って user に review を依頼する。渡すのは子の worktree の cwd・変更ファイル・検証結果・未解決事項で、対象は未コミット差分にする。指摘は ID・本文・位置・既存の返信を添えて子に `send` し、対応結果と返信文を受け取って root が返信し、再レビューまで同じ SKILL で扱う。子に review を起動させない。承認は次のフェーズへ進む条件の 1 つで、Git 操作の許可ではない。

## Git と統合

review の承認から Git の許可を推測しない。

1. **許可を確かめる** — root が user から明示された Git 操作の範囲を確かめ、足りない操作だけ許可を求める。commit・push・PR・merge の許可をレビュー承認から推測しない
2. **子に渡す** — 許可された操作と対象 branch を子に `send` する。子は自分の worktree でその範囲だけを実行し、commit hash や PR の merge commit など、統合先を確認できる結果を root に報告する
3. **統合する** — ローカル統合を許可された場合、子が作った commit を root の checkout で `git merge --ff-only ho/<feature>/<task>` により取り込む（root は commit を作らない）。PR 経由なら許可範囲で子に merge させ、root は default branch の checkout を `pull --ff-only` で進める。失敗したら root で止まり、reset や force push に切り替えない
4. **証拠を確かめる** — root が read-only の VCS 確認で、報告された統合 commit が default branch の HEAD に含まれることを確かめる。確認後だけ統合済みとして記録する。今回のフェーズがすべて統合済みなら ifd の手順 2 に戻り、一覧の残りから次の回を設計・合意してから渡す
5. **待ちを残す** — 許可が無い、統合できない、証拠が無いフェーズは root の todo を block にして user に伝える。未統合のフェーズを前提にする次のフェーズは始めない。手動起動された子 session と worktree は自動で停止・削除せず、完了報告に残存一覧を添える

完了条件: 今回のフェーズの承認と許可された統合の証拠がそろい、root が結果と残存 worktree を user に報告した。許可待ち・未統合があれば root の監督は終えない。一覧の残りがあれば次の回へ進み、無ければ全体を終える

```text
Bad: prompt と worktree を渡して root の作業を終わりにし、質問・review・統合を子と user に任せる
Good: root が待ちの todo を block にして intercom を待ち、質問に答え、review の窓口と統合の証拠確認を持ち続ける
```

なぜ: 子は会話の履歴を持たず、user と合意したつなぎ目を直せるのは root だけ。窓口が子に移ると、user はどちらに指摘し承認するかを迷い、root は統合の証拠を見ないまま次のフェーズを渡してしまう。
