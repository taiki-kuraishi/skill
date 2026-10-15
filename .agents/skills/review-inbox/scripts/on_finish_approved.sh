#!/bin/sh
set -eu

inbox_name=review-inbox
intercom="$HOME/.omp/plugins/node_modules/.bin/pi-intercom"

skill_repo=$(cd "$(dirname "$(readlink -f "$0")")" && git rev-parse --path-format=absolute --git-common-dir)
# $PWD は daemon の値のままなので、実体の cwd を使う
review_root=$(pwd -P)
review_repo=$(git -C "$review_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)

# 子 session は linked worktree で review を受けるので、worktree も含めてこの repo の review を除く
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
target=$("$intercom" list --json | jq -r --arg n "$inbox_name" '[.sessions[] | select(.name == $n)] | if length == 1 then .[0].id else empty end' || true)
if [ -z "$target" ]; then
  echo "review-inbox: no single live session named $inbox_name; saved $saved" >&2
  exit 0
fi
"$intercom" send --to "$target" --text "crit の review が approve されました。skill://review-inbox を読み、$saved を処理してください。" || true
