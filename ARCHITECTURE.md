# Shelf architecture & the Gmail coupling map

Shelf is a single content script that decorates Gmail's own DOM. That makes it
private by construction — and coupled to markup Google can change at any time.
This file exists so that when Gmail changes, the fix is a ten-minute edit, not
an afternoon of spelunking.

## The coupling points (all in `content.js`)

Every place Shelf touches Gmail's markup, what breaks if it changes, and how
it degrades:

| Selector / hook | Purpose | If it breaks | Degradation |
|---|---|---|---|
| `table.F` | find the thread-list table (`visibleThreadTable`) | everything list-related stops | silent no-op; canary fires if rows also unreadable |
| `tr.zA` | thread rows | grouping, notes, drags stop | canary banner ("can't read Gmail's layout") |
| `[data-legacy-thread-id]` (in rows and on the conversation `h2`) | stable thread identity — the key for every assignment and note | **the** load-bearing hook; all features stop | canary banner; falls back to `[data-thread-id]` first |
| `span.bog` | subject element — note chips insert after it | chips vanish (notes still stored) | drag ghost falls back to "(conversation)" |
| `ul[role="toolbar"]` (in rows) | hover-action toolbar our note/☰ buttons join | buttons fall back to a floating container | `.shelf-float` CSS path |
| Gmail's toolbar `li` metrics | copied at runtime (`syncLiMetrics`) for pixel alignment | misalignment only | still functional |
| `[data-tooltip="Refresh"]` / `"More"` (English-only) | anchors for the "+" toolbar button and conv note button | "+" moves to bottom-of-list row; conv icon hides | designed fallbacks |
| `h2[data-legacy-thread-id]` | open-conversation detection + strip anchor | conv-view notes stop (list notes fine) | silent |
| `location.hash` `#inbox` / `#label/...` | view detection (`currentLabel`) | grouping stops appearing | silent |
| `location.pathname` `/u/N/` | account namespacing | accounts could share sections | data safe, semantics off |
| first `[role="checkbox"]` per row | multi-select detection | pill stops appearing | single-thread flows unaffected |
| row background sampling (`updateThemeClass`) | dark-theme detection | wrong palette only | cosmetic |
| `[gh="tl"]` + class `aia` | reading-pane (split view) detection — click ownership must pass through there, since hash navigation always opens full-page | clicks in split view open full-page again | fallback: visible conversation `h2` coexisting with the list also counts as split |

Rules of thumb when fixing:
- Prefer attribute hooks (`data-legacy-thread-id`, `role=`) over class names —
  Gmail's classes (`zA`, `bog`, `F`) are minified and the most likely to churn.
- Never hardcode pixel metrics; copy them from Gmail's own elements at runtime.
- Every new Gmail touchpoint needs: a fallback or a graceful no-op, a row in
  this table, and ideally a canary condition.

## Failure-visibility ladder

1. **Canary banner** — ≥3 visible rows but zero readable thread ids → "Shelf
   can't read Gmail's current layout" (once per session).
2. **Dead-context banner** — `chrome.storage` throws (store auto-updated under
   an open tab) → "reload this tab so changes keep saving".
3. **Diagnostics ring buffer** — key failures append to `diag` in
   `chrome.storage.local` (last 40); users copy them from the options page
   into bug reports. Nothing is ever transmitted.

## Development workflow

- `tools/fixture.html` — minimal mock-Gmail page (chrome.storage mocked);
  loads the real `content.js` for hands-on poking.
- `tools/demo.html` — pretty staged inbox for screenshots/video.
- `tools/test.html` — the 16-test regression suite. Serve the repo root
  (`python3 -m http.server 8123`) and open `/tools/test.html`; the `<title>`
  reports PASS/FAIL. Drag tests self-skip in zero-size viewports.
- CI (`.github/workflows/ci.yml`) runs syntax checks + the suite in headless
  Chrome + a build on every push and PR.
- `tools/build.sh` — produces the store zip in `dist/` from only the shipped
  files.
- Bump `?v=` on `test.html`'s content.js script tag when testing repeatedly in
  a cached browser pane.

## Design principles (decided, not open questions)

- **Native or nothing.** Every surface uses Gmail's visual language: its
  grays, its chip idiom, its tooltip style, runtime-copied metrics. If a
  feature can't be made to look like Gmail shipped it, it doesn't ship.
- **Color is a vocabulary, not a palette.** Five curated colors + plain,
  hand-tuned as bg/text pairs across light/dark and every surface. No free
  color picker, ever — it outsources visual quality to chance. If users ask
  for more, add 2–3 curated Google-palette colors (purple/orange/teal);
  that's the whole escape hatch.
- **Meaning scales through structure** (shelves, sub-shelves — one level max),
  not through more colors or settings.
- **No settings page** until a decision genuinely can't have a good default.
- **Permission budget is zero.** Any feature needing a new permission is a
  different product; adding one disables the extension for every user until
  they re-approve.

## Source hygiene (learned the hard way)

- **Never put raw control bytes in source.** `hkey()` (header-element map) and
  `accountPrefix()` use a NUL separator — always written as the escape
  `'\u0000'`. Raw NULs make grep treat the file as binary and once cost hours.
- The storage layer is local-first (`chrome.storage.local`) with best-effort
  sync mirroring; merges are newest-wins per item, whole-object for `sections`
  versioned by `sectionsRev`. All known keys are enumerated in `options.js`
  (`KNOWN`) — keep that list in sync when adding keys.
