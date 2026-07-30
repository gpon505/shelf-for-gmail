#!/bin/sh
# "What will Chrome actually run?"
#
# Chrome runs the FILES IN THIS FOLDER — not your branch, not GitHub, not a
# worktree. Reloading Gmail never picks up extension changes; only reloading
# the extension card does, and it re-reads this folder.
#
# Run this before testing in Chrome, and before pushing. Exits non-zero if
# this folder is behind its remote (the classic "I tested stale code" trap).
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])" 2>/dev/null || echo '?')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "Chrome loads this folder:"
echo "  $ROOT"
echo "  version $VERSION   branch $BRANCH @ $SHA"
if [ "$DIRTY" != "0" ]; then
  echo "  $DIRTY uncommitted file(s) — these ARE live after an extension reload"
fi

# behind the remote? that's the trap: merged on GitHub, never pulled here
STALE=0
git fetch -q origin 2>/dev/null
UP=$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null)
if [ -n "$UP" ]; then
  BEHIND=$(git rev-list --count "HEAD..$UP" 2>/dev/null || echo 0)
  AHEAD=$(git rev-list --count "$UP..HEAD" 2>/dev/null || echo 0)
  [ "$AHEAD" != "0" ] && echo "  $AHEAD commit(s) not yet pushed to $UP"
  if [ "$BEHIND" != "0" ]; then
    echo ""
    echo "  STALE: $BEHIND commit(s) behind $UP."
    echo "  Chrome is running OLD code. Fix:  git pull --ff-only"
    STALE=1
  fi
fi

# a sibling worktree on a different version is how you end up testing the
# wrong thing while believing you shipped the right thing
if [ -d .claude/worktrees ]; then
  for wt in .claude/worktrees/*/; do
    [ -f "$wt/manifest.json" ] || continue
    WV=$(python3 -c "import json; print(json.load(open('$wt/manifest.json'))['version'])" 2>/dev/null || echo '?')
    if [ "$WV" != "$VERSION" ]; then
      echo ""
      echo "  NOTE: worktree $(basename "$wt") is version $WV, this folder is $VERSION."
      echo "  Chrome ignores worktrees. Only the folder above is loaded."
    fi
  done
fi

echo ""
if [ "$STALE" = "1" ]; then
  echo "=> Pull first, then hit reload on the Shelf card in chrome://extensions"
  exit 1
fi
echo "=> Up to date. Hit reload on the Shelf card in chrome://extensions to run v$VERSION"
