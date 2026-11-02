#!/bin/sh
set -eu

router_name=superagent
intercom="$HOME/.omp/plugins/node_modules/.bin/pi-intercom"

skill_repo=$(cd "$(dirname "$(readlink -f "$0")")" && git rev-parse --path-format=absolute --git-common-dir)
# $PWD は daemon の値のままなので、実体の cwd を使う
review_root=$(pwd -P)
review_repo=$(git -C "$review_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)

# この repo の review を再び SKILL 化する循環を、worktree も含めて防ぐ
[ "$review_repo" = "$skill_repo" ] && exit 0

payload=$(cat)
[ "$(printf '%s' "$payload" | jq '.comments_json | length')" -gt 0 ] || exit 0

inbox_dir="${XDG_STATE_HOME:-$HOME/.local/state}/review-inbox"
mkdir -p "$inbox_dir"
session_key=$(printf '%s' "$payload" | jq -r '.session_key')
saved="$inbox_dir/$session_key-$(date -u +%Y%m%dT%H%M%SZ).json"
# approve すると crit が review.json を消すので、ここで残したものが唯一の写しになる
printf '%s' "$payload" | jq --arg root "$review_root" '. + {repo_root: $root}' >"$saved"

# 名前で直接送ると、切断済みの同名 session にも queued として届いてしまう
count=0
target_dir=""
target=""
for dir in "$HOME/.pi/agent" "$HOME"/.omp/profiles/*/agent; do
  [ -d "$dir" ] || continue
  ids=$(PI_CODING_AGENT_DIR="$dir" "$intercom" list --json | jq -r --arg n "$router_name" '.sessions[] | select(.name == $n) | .id' || true)
  for id in $ids; do
    count=$((count + 1))
    target_dir="$dir"
    target="$id"
  done
done
if [ "$count" -ne 1 ]; then
  echo "review-inbox: no single live session named $router_name; saved $saved" >&2
  exit 0
fi
PI_CODING_AGENT_DIR="$target_dir" "$intercom" send --to "$target" --text "[review-inbox] crit の review が approve されました。skill://kstack-super-agent の「review の通知を受ける」に従い、$saved を処理してください。" || true
