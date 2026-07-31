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
| `aria-label`/`data-tooltip` starting with `"Refresh"` / `"More"` (English-only; matches Workspace's "More email options" too, and reads `aria-label` which is set at rest, not just the hover-only `data-tooltip`) | anchors for the "+" toolbar button and conv note button | "+" moves to bottom-of-list row; conv icon hides | designed fallbacks; conv button also anchors geometrically to the ⋮ just above the subject |
| `h2[data-legacy-thread-id]` | open-conversation detection + strip anchor | conv-view notes stop (list notes fine) | silent |
| `location.hash` `#inbox` / `#label/...` | view detection (`currentLabel`) | grouping stops appearing | silent |
| `location.pathname` `/u/N/` | account namespacing | accounts could share sections | data safe, semantics off |
| first `[role="checkbox"]` per row | multi-select detection | pill stops appearing | single-thread flows unaffected |
| row background sampling (`updateThemeClass`) | dark-theme detection | wrong palette only | cosmetic |
| multiple visible `table.F` (`multiplePanes`) | Priority Inbox / Multiple Inboxes render several thread tables — same positional-click hazard as split view, so grouping pauses there (notes/chips/filing stay) | grouping silently missing for those inbox types | pause toast names it once per session |
| reading-pane detection (`readingPaneActive`) | click ownership must pass through in split views, since hash navigation always opens full-page. Signals (any one suffices), calibrated against real-Gmail measurements (2026-07: no-split right-gap 72px vs vertical 527px; no-split scroller-bottom-gap 16px vs horizontal ~495px): visible conversation `h2` beside the list; tall card rows (>60px, majority of first 5); `.aia` container visible (reading-pane feature on — incl. its "No split" mode, so it only gates) AND list right-gap >300px (vertical) or list scroller ending >200px above the viewport (horizontal). The old `[gh="tl"].aia` marker is dead. | clicks in split view open full-page again | each nav decision + winning signal is recorded in the diag ring (Copy Diagnostics) |

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

## Gmail's keyboard cursor vs. Shelf's visual order (a closed question)

**Symptom:** in a label with shelves, `j`/`k` moves Gmail's cursor to rows that
look scattered — down three, then back up four. Reported from real use and
confirmed against a real inbox.

**Cause, measured:** Gmail's cursor advances exactly one row in *DOM* order per
press (10 presses moved it +10). Shelf never reorders the DOM — it repaints
rows with `translateY`. So the visual sequence and the DOM sequence are two
different orders, and the cursor walks the one you can't see. With shelves
`slef 1 / Everything else / shelf2`, visual positions mapped to DOM indices
`[0,4,5,1,2,3,6,7,8,9,10,11,12,15,13,14]`, so `j` from the top lands on visual
rows 0 → 3 → 4 → 5 → 1 → 2 → 6.

**This is structural, not a bug to chip away at.** Gmail identifies a thread by
its row's DOM index; Shelf's correctness depends on never changing that index.
Both cannot hold while the cursor walks visual order. Three fixes were
considered and each is ruled out by evidence — don't re-attempt without new
information:

| Approach | Why it fails |
|---|---|
| Drive Gmail's cursor with synthetic key events | Gmail ignores untrusted events. Verified in a real inbox: dispatching a fully-formed `KeyboardEvent` for `j` (`keyCode` 74, from the focused row) did not move the cursor. |
| Reorder the DOM so both orders agree | This is the v0.19.0 regression (see the note above `cardRows` in `content.js`): Gmail resolves a clicked thread by the row's index among tbody `<tr>`s, so reordering opens the wrong email. |
| Let Shelf move focus itself | Gmail's internal cursor desyncs from the focused row, so `Enter`/`o` opens a different thread than the one highlighted — the v0.19.0 failure mode relocated. |

**What is true today:** Shelf's own shortcuts always act on the correct thread.
`shortcutRow()` resolves the target by input intent — Gmail's cursor row when
the keyboard is driving, the hovered row when the pointer is. Only the *travel*
between threads is disordered.

**The real fix, if it ever earns its keep:** a Shelf-managed cursor that moves
in visual order and owns its own open/select instead of borrowing Gmail's. That
means intercepting `Enter`/`o` as well — a feature, not a patch.

Gmail's cursor row is identifiable: it carries `tabindex="0"` (every other row
`-1`) plus a marker class (`btb` when measured). `cursorRow()` prefers the
tabindex — `document.activeElement` goes stale the moment focus leaves the page
(a devtools pane, another window), which would silently hand targeting back to
the pointer.

## Source hygiene (learned the hard way)

- **Never put raw control bytes in source.** `hkey()` (header-element map) and
  `accountPrefix()` use a NUL separator — always written as the escape
  `'\u0000'`. Raw NULs make grep treat the file as binary and once cost hours.
- The storage layer is local-first (`chrome.storage.local`) with best-effort
  sync mirroring; merges are newest-wins per item, whole-object for `sections`
  versioned by `sectionsRev`. All known keys are enumerated in `options.js`
  (`KNOWN`) — keep that list in sync when adding keys.
