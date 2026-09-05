#!/bin/bash
# Verify every vercel.json ignoreCommand from BOTH working directories.
#
# Vercel runs ignoreCommand from the project's Root Directory, which for every
# project except the landing page is artifacts/<project>, NOT the repo root.
# A pathspec written as "artifacts/business-portal" matches nothing from there,
# so `git diff --quiet` finds no changes and exits 0 — which Vercel reads as
# "cancel this build". The failure is silent: the deployment just shows as
# CANCELED and the site keeps serving the previous build.
#
# That is exactly how it shipped once already: production deploys of the
# business portal were skipped for three consecutive merges before anyone
# noticed. The earlier check for this only ever ran from the repo root, where
# the bug is invisible — so this script runs each command from both places and
# requires them to agree.
#
# Pathspecs must therefore be top-level-relative (":/artifacts/...", git's
# "relative to repo root" prefix), which resolves identically from any cwd.
#
# Usage: scripts/verify-vercel-ignore.sh [commit]   (default: HEAD)
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"
ROOT="$PWD"
COMMIT="${1:-HEAD}"
fails=0

for cfg in vercel.json artifacts/*/vercel.json; do
  [ -f "$cfg" ] || continue
  cmd=$(node -e 'const c=require("./"+process.argv[1]);process.stdout.write(c.ignoreCommand||"")' "$cfg")
  [ -n "$cmd" ] || { echo "SKIP  $cfg (no ignoreCommand)"; continue; }

  case "$cfg" in
    vercel.json) projdir="$ROOT" ;;
    *)           projdir="$ROOT/$(dirname "$cfg")" ;;
  esac

  # A bare pathspec silently matches nothing outside the repo root.
  if grep -qE '\-\- [^:]' <<<"$cmd"; then
    echo "FAIL  $cfg — pathspecs are not top-level-relative (expected ':/' prefixes)"
    fails=$((fails + 1))
  fi

  resolved=${cmd//HEAD/$COMMIT}
  root_rc=0; ( cd "$ROOT"    && eval "$resolved" >/dev/null 2>&1 ) || root_rc=$?
  proj_rc=0; ( cd "$projdir" && eval "$resolved" >/dev/null 2>&1 ) || proj_rc=$?

  if [ "$root_rc" -ne "$proj_rc" ]; then
    echo "FAIL  $cfg — cwd-dependent: repo-root exit=$root_rc, project-dir exit=$proj_rc"
    fails=$((fails + 1))
  else
    verdict=$([ "$root_rc" -eq 0 ] && echo "skip build" || echo "build")
    echo "ok    $cfg — same from both cwds ($verdict)"
  fi
done

if [ "$fails" -gt 0 ]; then
  echo; echo "$fails problem(s) found."; exit 1
fi
echo; echo "All vercel.json ignoreCommands agree from both working directories."
