#!/usr/bin/env bash
# CI only (.github/workflows/pr-shots.yml): build + serve the PR's base and head, screenshot
# the routes in .github/pr-shots.json on each, push PNGs to the orphan branch `ci-screenshots`
# and post ONE sticky comment (<!-- ui-shots:pairs=N -->) that scripts/check_ui_proof.py accepts.
# Non-blocking: nothing here is a required check. Needs contents:write + pull-requests:write.
#
#   scripts/pr_shots_ci.sh <pr> <head-sha> <base-sha>
set -uo pipefail
PR="$1"; SHA="$2"; BASE="$3"
REPO="${GITHUB_REPOSITORY:?}"
W="${RUNNER_TEMP:-/tmp}/prshots"; OUT="$W/out"; PW="$W/pw"
rm -rf "$W"; mkdir -p "$OUT/before" "$OUT/after" "$PW"
CFG="$PWD/.github/pr-shots.json"
cfg() { jq -r "$1" "$CFG"; }
INSTALL="$(cfg '.install // "npm ci"')"; BUILD="$(cfg '.build // "npm run build"')"
START="$(cfg '.start')"; PORT="$(cfg '.port // 3000')"; WORKDIR="$(cfg '.workdir // "."')"
ROUTES=($(cfg '.routes[]'))
# env vars for the build (public placeholders only - never secrets)
while IFS='=' read -r k v; do [ -n "$k" ] && export "$k=$v"; done < <(jq -r '(.env // {}) | to_entries[] | "\(.key)=\(.value)"' "$CFG")

export SHOTS_HEADERS="$(jq -c '.headers // empty' "$CFG")"
( cd "$PW" && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1 )
cp scripts/pr-shots.mjs "$PW/pr-shots.mjs"

capture() { # <side> <dir>
  local side="$1" dir="$2" pid
  ( cd "$dir/$WORKDIR" && eval "$INSTALL" && eval "$BUILD" ) >"$W/$side-build.log" 2>&1 || { echo "$side build failed"; tail -20 "$W/$side-build.log"; return 1; }
  ( cd "$dir/$WORKDIR" && eval "$START" ) >"$W/$side-serve.log" 2>&1 &
  pid=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null --max-time 3 "http://localhost:$PORT/" && break; sleep 2; done
  ( cd "$PW" && node pr-shots.mjs "http://localhost:$PORT" "$OUT/$side" "${ROUTES[@]}" ) || true
  ( cd "$PW" && node pr-shots.mjs --mobile "http://localhost:$PORT" "$OUT/$side/mobile" "${ROUTES[0]}" ) || true
  pkill -P $pid 2>/dev/null; kill $pid 2>/dev/null; sleep 2
}
git worktree add -q "$W/base" "$BASE" 2>/dev/null || git worktree add -q --detach "$W/base" "$BASE"
capture before "$W/base"; capture after "$PWD"

# pairs = images present on both sides
PAIRS=0; ROWS=""
DEST="pr-${PR}/${SHA:0:9}"
URLB="${GITHUB_SERVER_URL:-https://github.com}/${REPO}/blob/ci-screenshots/${DEST}"
while IFS= read -r f; do
  rel="${f#$OUT/after/}"
  if [ -f "$OUT/before/$rel" ]; then
    PAIRS=$((PAIRS+1))
    ROWS="$ROWS| \`$rel\` | <img src=\"$URLB/before/$rel?raw=true\" width=\"380\" alt=\"before $rel\"> | <img src=\"$URLB/after/$rel?raw=true\" width=\"380\" alt=\"after $rel\"> |"$'\n'
  fi
done < <(find "$OUT/after" -name '*.png' | sort)

if [ "$PAIRS" -gt 0 ]; then
  T="$(mktemp -d)"; AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "${GITHUB_TOKEN:?}" | base64 | tr -d '\n')"
  git -C "$T" init -q; git -C "$T" config user.name "github-actions[bot]"; git -C "$T" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git -C "$T" remote add origin "${GITHUB_SERVER_URL:-https://github.com}/${REPO}.git"
  g() { git -C "$T" -c http.extraheader="$AUTH" "$@"; }
  ok=0
  for attempt in 1 2 3 4 5; do
    if g ls-remote --exit-code origin refs/heads/ci-screenshots >/dev/null 2>&1; then
      g fetch -q --depth 1 origin ci-screenshots; git -C "$T" checkout -q -B ci-screenshots FETCH_HEAD
    else
      git -C "$T" checkout -q --orphan ci-screenshots
      printf '# ci-screenshots\n\nBEFORE/AFTER images for PR comments, written by .github/workflows/pr-shots.yml. Never merge this branch.\n' > "$T/README.md"; git -C "$T" add README.md
    fi
    rm -rf "${T:?}/$DEST"; mkdir -p "$T/$DEST"; cp -R "$OUT/before" "$OUT/after" "$T/$DEST/"
    git -C "$T" add -A "$DEST"; git -C "$T" commit -q -m "pr-${PR} ${SHA:0:9}" || true
    g push -q origin HEAD:refs/heads/ci-screenshots && { ok=1; break; }
    sleep $((attempt*3))
  done
  [ "$ok" = 1 ] || { echo "::error::could not push to ci-screenshots"; exit 0; }
  BODY="<!-- ui-shots:pairs=$PAIRS -->
### Auto screenshots - BEFORE / AFTER (\`${SHA:0:9}\`)

| Route | BEFORE (base) | AFTER (this PR) |
|---|---|---|
$ROWS
_Captured by .github/workflows/pr-shots.yml. Not a pixel gate: a human reviews them. Images render for repo members only._"
else
  BODY="<!-- ui-shots:pairs=0 -->
Auto screenshots: no routes could be captured on both sides (build or serve failed). Add BEFORE/AFTER by hand (see the PR template)."
fi
# sticky: update the existing comment, else create
CID="$(gh api "repos/$REPO/issues/$PR/comments?per_page=100" --jq '[.[]|select(.user.login=="github-actions[bot]" and (.body|contains("<!-- ui-shots:pairs=")))][0].id // empty')"
if [ -n "$CID" ]; then gh api -X PATCH "repos/$REPO/issues/comments/$CID" -f body="$BODY" >/dev/null
else gh api -X POST "repos/$REPO/issues/$PR/comments" -f body="$BODY" >/dev/null; fi
echo "pairs=$PAIRS"
# the UI proof check may already have failed before this comment existed - re-run it
RID="$(gh run list --repo "$REPO" --workflow "UI proof" --commit "$SHA" --json databaseId,conclusion --jq '[.[]|select(.conclusion=="failure")][0].databaseId // empty' 2>/dev/null)"
[ -n "$RID" ] && gh run rerun "$RID" --repo "$REPO" --failed >/dev/null 2>&1 || true
