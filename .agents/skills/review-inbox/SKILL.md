---
name: review-inbox
description: "他のリポジトリの Crit review が approve されたときに、指摘を保存して kstack-super-agent の router に通知するフックのセットアップ手順。フックの設定・確認、通知が届かないときの調査に使用する。通知後の処理は kstack-super-agent の「review の通知を受ける」に従う。"
metadata:
  internal: true
---

# review-inbox

他のリポジトリの Crit review が approve されると、`scripts/on_finish_approved.sh`（crit の global フック）がコメントを `${XDG_STATE_HOME:-$HOME/.local/state}/review-inbox/` に保存し、名前が `superagent` の router に保存先を intercom で送る。router は `skill://kstack-super-agent` の「review の通知を受ける」に従って review ごとに別の worktree・lead を起動し、lead が `skill-from-review` を回す。専用の `review-inbox` session は起動しない。

## セットアップ（マシンごとに 1 回）

環境変数 `KSTACK_SKILL_REPO` に taiki-kuraishi/skill の **main checkout**（削除する worktree ではない）の絶対 path を設定し、`~/.crit.config.json` の `hooks` にフックを書く（他のキーは消さない）。

```json
{
  "hooks": {
    "on_finish_approved": "inline:exec \"$KSTACK_SKILL_REPO/.agents/skills/review-inbox/scripts/on_finish_approved.sh\""
  }
}
```

- crit はフックを、crit を起動した agent の env で動かす。`KSTACK_SKILL_REPO` が無い agent から approve すると、フックは exit 127 で失敗し、指摘も保存されない。login shell で読まれる場所に設定し、設定より前に起動した agent と crit は起動し直す。router にも、worktree の作成先としてこの環境変数が要る
- 設定できたかは、crit を起動する agent の shell で `test -x "$KSTACK_SKILL_REPO/.agents/skills/review-inbox/scripts/on_finish_approved.sh"` と `jq -e '.hooks.on_finish_approved' ~/.crit.config.json` の両方が通ることで確かめる
- フックは `~/.pi/agent` と `~/.omp/profiles/*/agent` の連絡網を探し、全体で `superagent` がちょうど 1 つのときだけ session id 宛てに送る。router と approve 元の profile は揃えなくてよい。0 個・複数・送信失敗では保存だけが残るので、通知されなかった JSON の絶対 path を router に渡す
- router の broker の config（`$PI_CODING_AGENT_DIR/intercom/config.json`、未指定なら `~/.pi/agent/intercom/config.json`、profile 使用時は `~/.omp/profiles/<profile>/agent/intercom/config.json`）に `busyDelivery` を `"human-first"` で足す（他のキーは消さない）。通知が届くのは turn 終了後でも、先行 review の完了を待たず別の lead を起動する
- フックは `jq`・`git`・`node`（`~/.omp/plugins/node_modules/.bin/pi-intercom` は `node` で動く）を使う。crit の daemon の PATH に `jq` か `git` が無いと保存もされず、`node` が無いと保存だけされて通知が届かない
- router で使う `kstack-super-agent` の配布コピーも、この変更を含む版に更新して読み直す。フックだけ更新しても、古い SKILL には通知を受ける手順が無い。この内部 SKILL は別 repo の router から名前で解決できないので、`$KSTACK_SKILL_REPO/.agents/skills/review-inbox/SKILL.md` を直接読む

## 保存と承認の境界

- `comments_json` が空なら保存・通知しない。approve 時に空になる `comments_unresolved_json` では判定しない
- この repo 自身の review は、worktree を含めて保存・通知しない。SKILL 更新の review が次の入力になる循環を防ぐ
- 元 repo の approve は入力の保存と通知の契機で、新しく書く SKILL の承認ではない。lead が分類案・追記か新規作成かを user に問い、変更内容を Crit で改めて review してもらう
- 承認後の commit・push・PR・merge は `kstack-super-agent/references/lead.md` の「承認後の操作」に従う。default branch に直接 push する旧運用は使わない

```text
Bad: router が JSON の指摘を分類して編集する / 前の review が終わるまで次の lead を起動しない
Good: router は保存 path だけを lead に渡し、lead ごとの worktree・台帳で並行して進める
```

なぜ: user の窓口を router にまとめたまま、指摘の解釈と変更・承認の範囲を review ごとに分離する。
