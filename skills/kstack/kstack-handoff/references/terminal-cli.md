# terminal-cli

`kstack-handoff` の端末操作を、herdr と Tern の両方で行うための手順。root が子の omp を起動し、prompt を届け、様子を見て、片付けるところだけをここに置く。worktree の作成、子との取り決め、review、commit・push・PR・merge は `kstack-handoff` の本文に従う。

ID は推測せず、コマンドが返した JSON から読む。1 回の委任の途中で端末を切り替えない（Herdr で始めたタスクを Tern で見に行かない）。

## 端末を選ぶ

root が動いている端末を 1 回だけ判定し、以後はその端末の手順だけを使う。

| 条件                                                               | 端末   | 使う節           |
| ------------------------------------------------------------------ | ------ | ---------------- |
| `test "${HERDR_ENV:-}" = 1`                                        | Herdr  | 各節の **Herdr** |
| 上の条件を満たさず、`tern ls --json` が終了コード 0 で JSON を返す | Tern   | 各節の **Tern**  |
| どちらでもない                                                     | 止まる | user に伝える    |

- 端末が判定できなければ、user に何が足りないかを伝えて止まる。pane の文面を user に運んでもらう運用に黙って切り替えない
- Herdr の中で `herdr` のコマンドが失敗したら、その理由を user に伝えて止まる。Tern に切り替えて続けない
- `tern ls --json` は Tern の pane の外からでも動く（daemon に socket でつなぐ）。この環境では `TERN_WINDOW_KEY` が空でも `tern ls --json`・`tern inspect --json` が通った

### root の場所を控える

**Herdr** — root の workspace は `$HERDR_WORKSPACE_ID`、pane は `$HERDR_PANE_ID`。`herdr agent list` で root の pane を確かめて控える。子 workspace は root の workspace の下にだけ開ける。

**Tern** — root の block・session を `tern inspect --json` から引く。

```bash
tern inspect --json
```

- `intercom({ action: "status" })` の `Session ID`（UUID）を `.panes[].omp_session_file` の basename 末尾（`_<UUID>.jsonl`）と突き合わせ、対応する `.panes[].pane` を root の block id とする。`tern whoami --json` は接続元の identity で、block id の取得には使わない
- block id を `.sessions[].tabs[].blocks[].id` と照合して root の所有 session と tab を引き、`.sessions[].id`・`.sessions[].name`・`.tabs[].id` を控える
- 一致が 0 件なら、接続先の window で root を特定できないと user に伝えて止まる。root が素の端末にいるなら Tern 内で起動し直し、別 window にいるなら正しい `--window KEY` を指定してから再開する。存在しない pane を user に選ばせない
- 複数一致なら止まり、user にどの pane が root かを聞く。`@focused` や先頭の window を root とみなさない
- cwd の一致だけでは決めない（同じ checkout で複数の omp が動きうる）

控える値: root の block id、root の session id・名前、root の tab id。task ごとの子の block id は「起動」で足す。

## 起動

worktree は `kstack-handoff` の「起動」で wt に作らせ、返った `.path` を使う。子の omp はその path で起動する。

### Herdr で起動する

```bash
# 1. root の workspace の下に子 workspace を開く。.result.workspace.workspace_id と .result.root_pane.pane_id を控える
herdr worktree open --workspace "$HERDR_WORKSPACE_ID" --path <path> --label "ho:<feature>/<task>" --no-focus

# 2. omp を起動する。入力を受け付けられるようになってから返る
herdr agent start ho-<feature>-<task> --kind omp --pane <pane_id> --timeout 60000
```

### Tern で起動する

```bash
# 1. main の omp が動く root block を分割し、wt が返した path で子の omp を起動する
tern split <root block> right --cwd <path> --json -- omp

# 2. 返った block を root block 上の floating パネル（picture in picture）にする
tern pip <block> --over <root block> --json

# 3. 子が omp で、worktree にいることを確かめる
tern process <block> --json
```

- `tern split` の `--json` は `{"session":<id>,"tab":<id>,"block":<id>}` の flat な JSON を返す。session・tab が root と同じであることを確かめ、子の block id を控える。新しい session・tab は作らない
- `tern process <block> --json` の `.foreground.name` が `omp`、`.foreground.cwd` が worktree の path であることを見て、`tern capture <block> --scrollback --surfaces` で入力を受け付ける画面まで起動したことを確かめてから名前と prompt を送る。起動できなければ画面と理由を user に報告する
- `tern inspect --json` の子の block に `pip.owner` があり、root の block id と一致することを確かめる。`pip` に失敗したら分割パネルのまま進めず、画面と理由を user に報告する
- `tern` は `--window KEY`、無ければ `$TERN_WINDOW_KEY`、それも無ければ先頭の window を対象にする。起動前に、同じ指定で実行した `tern inspect --json` に root が一意に含まれることを確かめ、その指定を起動・送信・確認・片付けまで保つ。root が見つからなければ子を起動せず止まる
- root の session id・tab id と子の block id を、task・worktree・branch と同じ todo の項目に書く。複数の子もそれぞれ同じ root block の上に浮かせ、以後の送信・画面取得は各子の block id で行う
- omp が起動しなかったときは「様子を見る」の capture で画面を読み、user に報告する

## 名前を付ける

intercom 名を子の端末名にそろえる。slash command は turn を始めないので、完了を待たない。`review-inbox` の root 自身に名前を付ける場合は、以下の宛先を「端末を選ぶ」で同定した root の pane／block id、alias を `review-inbox` に置き換え、prompt 本体は送らない。

### Herdr で名前を付ける

```bash
herdr agent prompt ho-<feature>-<task> '/alias ho-<feature>-<task>'
```

### Tern で名前を付ける

```bash
tern send <block> paste '/alias ho-<feature>-<task>'
tern send <block> keys Enter
```

- Tern の宛先は同定済みの block id で指定する。`@focused` では別の session に入力しかねない。Herdr も root の alias 設定では同定済みの pane id を使う
- 子への prompt は、入力可能な画面と alias 設定の結果を capture または intercom の list で確かめてから送る。root 自身への alias 設定では、自分の turn の終了を待つコマンドを使わない
- prompt 本体は改行・引用符・backtick を shell の quote で壊さないよう、`kstack-handoff` の「起動」と同じく file から渡す

```bash
# Herdr: 子が turn を始めるまでだけ待つ
herdr agent prompt ho-<feature>-<task> "$(cat /tmp/ho-<feature>-<task>.md)" --wait --until working --timeout 30000

# Tern: paste は送信しないので、Enter を別に送る
tern send <block> paste "$(cat /tmp/ho-<feature>-<task>.md)"
tern send <block> keys Enter
```

Tern の `paste` は bracketed paste で 1 つの message として入り、`keys Enter` で送信される。`herdr agent prompt` の `--wait --until working` に当たる待ちは無いので、送れたかは「様子を見る」で確かめる。始まったことの証拠は子の intercom の開始報告にする。

## 様子を見る

最初に見るのは `intercom({ action: "list" })`。子の状態と宛先は intercom が持ち、端末は画面を読むためだけに使う。

### Herdr で様子を見る

```bash
herdr agent read ho-<feature>-<task> --source recent-unwrapped --lines 80   # 様子を見る
herdr agent read ho-<feature>-<task> --source visible --lines 40            # 起動に失敗したとき
```

### Tern で様子を見る

```bash
tern capture <block> --scrollback --surfaces
tern inspect --json
```

- `--surfaces` を付ける。付けないと、omp の UI は capture に写らず空で返る（実測）
- `tern inspect --json` の `.panes[]` は block ごとに `pane`（block id）・`cwd`・`working`・`quiet_ms`・`omp_session_file` を持つ。block id は `.sessions[].tabs[].blocks[].id` と同じ値なので、session を引くのに使える
- `working` と `quiet_ms` は「いま pane が動いているか」だけを表す。`.working` が `false` でも完了とは読まない。完了は子の intercom の報告と、その後の review で確かめる
- `tern wait <block> --until exit|prompt|idle=MS --timeout SECONDS` は pane の出力待ちで、agent の turn の完了待ちではない（`--until exit` はプログラムの終了コード、124 は時間切れ）。子の完了を `tern wait` で待たない
- 画面を読んでも報告が無いまま止まっている子には、`intercom({ action: "send", to, message })` で報告を求めるか答えを送る

## 片付け

merge が済んだタスクの子だけを閉じる。閉じる前に、子が commit 済みで、統合が終わっていることを確かめる。

### Herdr で片付ける

```bash
herdr workspace close <workspace_id>
```

### Tern で片付ける

```bash
# <block> は tern split が返した子の block id。root の block は閉じない
tern close <block> --json
```

- 閉じる前に `tern inspect --json` で子の block id と root の対応を確かめ、作成した子の floating パネルだけを閉じる
- root と同じ session・tab を共有しているので、session 全体を終了する `tern kill session` は使わない。root や他の子、user のパネルを巻き込まない
- 宛先は起動で控えた子の block id だけにする。`@focused` は使わない
- 閉じたあと、`kstack-handoff` の「統合」に従って `wt remove` と `/tmp/ho-<feature>-<task>.md` の削除を行う
