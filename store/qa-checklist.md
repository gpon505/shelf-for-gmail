# Pre-launch QA checklist — run in REAL Gmail (~25 min)

The automated suite covers logic; this covers everything only a real Gmail
account can prove. Run top to bottom once before store submission, and again
after any Gmail-facing change. Anything broken → file it, don't ship it.

## Core flows (5 min) — your normal account, default settings

- [ ] Create a shelf via ＋, via ☰ → New section, via fallback (both paths render identically)
- [ ] Drag a thread onto a shelf: glide animation, yellow settle-flash, lands correctly
- [ ] Drag a thread to Gmail's sidebar label — Gmail's own drag still works untouched
- [ ] Start a drag, press **Esc** — cleanly cancelled; start another drag immediately after
- [ ] Start a drag, release the mouse **outside the browser window**, come back — nothing stuck
- [ ] Drag with a target shelf **off-screen** — list autoscrolls near top/bottom edges
- [ ] Multi-select 3 threads → pill appears → move all → all land, flash together
- [ ] Reorder shelves by dragging headers; move "Everything else" to top; plain click still collapses
- [ ] Note: create (Alt+N), bold something, ⌘K a selected word, pick a color, ⌘⏎ to save
- [ ] Click the link inside the sticky strip → opens in new tab (does NOT open the editor)
- [ ] Hover a truncated chip → styled tooltip with full note
- [ ] Delete a note via ✕ — chip, strip, and row edge all disappear

## Gmail configurations (10 min) — Settings → quick toggle each

- [ ] **Reading pane ON (right)**: sections render in the list pane; conversation strip appears; nothing overlaps
- [ ] **Reading pane ON (below)**: same checks
- [ ] **Compact density**: row buttons still align with archive/delete; headers look right
- [ ] **Dark theme**: every surface (chips, strips, menus, banners, pill, tooltips, popup)
- [ ] **A Gmail theme with a background image**: headers/chips still legible
- [ ] **Category tabs on (Primary/Promotions)**: sections show per tab without weirdness
- [ ] **Priority Inbox / Multiple Inboxes**: grouping attaches to the main pane only; no crashes elsewhere
- [ ] **Browser zoom 80% and 125%**: alignment, tooltips, drag targeting all sane
- [ ] **Second Gmail account (u/1)**: its shelves are separate; note colors/notes don't bleed

## Longevity & churn (5 min)

- [ ] Leave Gmail open 10+ min, let new mail arrive — sections stay grouped, no flicker loops
- [ ] Archive a thread that's on a shelf — it leaves gracefully; count updates
- [ ] Open DevTools console on the Gmail tab — **zero red errors** from content.js during all of the above
- [ ] Background the tab 2 min, use another app, return — everything still responsive
- [ ] Reload Gmail — all shelves/notes/colors persist exactly
- [ ] **Wrong-email regression**: in a grouped label, wait for/trigger a list refresh (new mail, switch label away and back), then click several threads across different shelves — each opens exactly the thread its row shows
- [ ] Ctrl/⌘-click a thread row in a grouped label — Gmail's native behavior (e.g., nothing/new tab) is untouched
- [ ] Click a thread in a grouped label with reading pane ON — correct thread loads in the pane

## Coexistence & a11y (5 min)

- [ ] With your other extensions enabled (1Password etc.) — no visual conflicts
- [ ] Gmail keyboard shortcuts still work (j/k/e/r) when NOT editing a note
- [ ] While editing a note, letters do NOT trigger Gmail shortcuts
- [ ] Tab to a Shelf button → visible focus ring → Enter activates it
- [ ] System Settings → Accessibility → Reduce Motion ON → drops are instant (no glide/flash)

## Data safety (2 min)

- [ ] Options → Export — JSON contains your sections + notes (open it and look)
- [ ] chrome://extensions → ↻ refresh Shelf while a Gmail tab is open, then edit something in the STALE tab → "reload this tab" banner appears
