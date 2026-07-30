# Working on Shelf

Orientation: `ARCHITECTURE.md` (how it works and why), `DESIGN.md` (visual
rules), `RELEASING.md` (shipping), `README.md` (features).

## Test locally first, then push

Shelf is loaded **unpacked** in Greg's Chrome from this repo folder. That means:

- **Chrome runs the files in this folder** — not your branch name, not GitHub.
- **Reloading Gmail does nothing.** Extension changes only load when you hit
  reload (↻) on the Shelf card in `chrome://extensions`, which re-reads this
  folder. Say so explicitly when you ask Greg to test.
- **A git worktree is NOT what Chrome loads.** If you're working in
  `.claude/worktrees/…`, your changes are invisible to Chrome. Make changes
  Greg needs to test in this folder, on a branch.
- **Merging on GitHub does not update this folder.** If you merge a PR, this
  checkout stays behind until someone runs `git pull` here.

Before asking Greg to test anything, and before pushing:

```sh
./tools/dev-status.sh
```

It prints the version/branch/sha Chrome will actually run and exits non-zero if
this folder is behind its remote. This exists because a session once merged to
GitHub, never pulled locally, and Greg tested stale 1.2.0 code believing it was
the new build.

Order of operations: **change here → `./tools/dev-status.sh` → reload the card →
verify in Chrome → commit → push → PR.**

## Every behavior change needs a test

`tools/test.html` is a real regression suite (43 tests) that CI runs headless
and asserts `<title>PASS`. Add a case for anything you change; a feature landing
without one is a gap, not a shortcut.

Run it exactly like CI:

```sh
python3 -m http.server 8123 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --window-size=1280,900 --force-prefers-reduced-motion \
  --virtual-time-budget=120000 --dump-dom http://localhost:8123/tools/test.html \
  | grep -o '<title>[^<]*'
```

`--force-prefers-reduced-motion` is required: row glides are CSS transitions
that don't follow the virtual-time clock, so mid-glide rects poison visual-order
assertions.

**Prove a regression test actually catches the bug** — revert the fix, watch it
go red, restore. A green test that would never fail is worse than none.

Other fixtures: `tools/demo.html` (staged inbox for screenshots/video),
`tools/fixture.html`, `tools/perf.html`.

## Gotchas that cost real time

- **Rows move by CSS `transform`, not DOM order.** `querySelectorAll('tr.zA')`
  is always Gmail's date order. Read on-screen order from geometry, or better,
  from the rank model (`bucketOrder`).
- **Gmail owns the tbody.** Never add, remove, or reorder its rows — split view
  resolves clicks by row position and injected rows corrupt that map. Headers
  live in an overlay (`.shelf-header` divs, not `tr`).
- **The version lives only in `manifest.json`.** Popup/options read it via
  `chrome.runtime.getManifest().version`. Bump it for user-visible changes
  (patch for fixes, minor for features) or Greg won't see a new version.
- **Never record or screenshot Greg's real inbox.** Use the staged fixtures.
