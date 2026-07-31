# Shelf — sections & notes for Gmail

Group threads under your own section headers inside Gmail label views (e.g. **Action** → "IGNITE work", "Talent"), and attach a private note to any thread ("waiting on Laura's reply"). Everything renders in Gmail's own visual language.

**Shelf never touches your email — it can't.** It's a page-level extension: no Gmail API, no OAuth grant, no background access. It can't create/delete labels, send, archive, or read anything server-side. Your sections, groupings, and notes live on your device in Chrome's extension storage (mirrored to Chrome sync when it fits). Uninstall it and Gmail is exactly as it was.

## Why this exists

I live in Gmail. I work in education, which means my inbox is a firehose of
parent emails, student questions, forms, and follow-ups — half of them
"waiting on someone," with context I'd otherwise have to reconstruct every
single time I reopened the thread. I keep a tight inbox and label everything,
and for years I kept hitting the same wall: a label is just a smaller pile.
Opening my "Action" label and seeing thirty undifferentiated threads told me
nothing about what I was waiting on, what was urgent, or what I'd already
dealt with in my head.

I tried the big organizer tools. Every one of them wanted full access to my
mailbox — read, send, delete — to draw their interface over it, and most of
them turned Gmail into a different app entirely. I didn't want a different
app. I wanted Gmail, plus shelves.

So I built the lightest possible version for myself: drag threads under your
own headers, stick a note on a conversation, in Gmail's own visual language —
and architecturally unable to touch the mail itself, because it never asks
for any access to it. Then my wife started using it — she's the opposite of
me, things just vanish into her inbox — and it stuck for her too. That's when
friends told me to publish it.

This repo is the whole thing. It's small on purpose — read it, and you'll see
there's no server, no analytics, and no way for it to see your email.

## Install (about 60 seconds)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (toggle, top-right)
3. Click **Load unpacked** and select this folder (`shelf-for-gmail`)
4. Open Gmail and click into a label view (e.g. **Action** in your left sidebar)

After any code update, hit the ↻ refresh icon on the Shelf card in `chrome://extensions`, then reload the Gmail tab.

## How to use

Shelf activates in **label views and the inbox** (search results stay untouched). The inbox keeps its own set of sections, separate from every label's.

- **Create a section:** click the **＋ button** in the list toolbar (next to the ⋮ menu — falls back to a "New section" row at the bottom of the list on non-English Gmail), or hover any thread row → click the **☰ shelf icon** → **New section…**. Empty sections sit above "Everything else" until you move threads in. (A one-time dismissible hint at the top of label views points out the hover flow.)
- **Move threads:** **drag any row** and drop it on a section header (Gmail's drag-to-sidebar-label still works — headers show a dashed outline while you drag), or click the ☰ icon and pick a section from the menu.
- **Move several at once:** select threads with their checkboxes → a **"Move to section"** pill appears bottom-center. Dragging a selected row also moves the whole selection.
- **Collapse a section:** click its header. Counts stay visible.
- **Color a shelf:** hover the header → **⋯** → pick from the swatches under "Shelf color" — the shelf's name becomes a compact tinted chip, like Gmail's own label chips (great for an "Urgent" shelf). The ∅ swatch clears it. Works on "Everything else" too.
- **Sub-shelves:** hover a shelf → **⋯** → *Add sub-shelf…* — nest stages under a shelf ("Hiring" → Applications / Interviewed / Follow up). Sub-shelves indent, the parent's count totals the whole group, collapsing the parent folds everything, and dragging the parent moves the block. Removing a parent promotes its sub-shelves.
- **Order threads within a shelf:** drag a thread between two others in a section — the insertion line shows exactly where it lands. New arrivals appear at the top of the shelf; your hand-placed order holds below.
- **Reorder sections:** drag a section header up or down — a blue insertion line shows where it will land. (The ⋯ menu's Move up/down still works too.) **"Everything else" is movable too** — drag it to the top for a triage-first layout where unfiled mail shows above your shelves. It can't be renamed or removed.
- **Rename / remove a section:** hover the header → **⋯** menu. Removing a section never touches the emails — they just return to "Everything else." The "Everything else" section can be renamed too (its ⋯ menu says it's the default section; clearing the name resets it) — it just can't be removed.
- **Keyboard shortcuts:** **Alt+N** (note), **Alt+M** (move to section), **Alt+↑/↓** (reorder within its shelf or the "Everything else" pile). They act on whichever thread you last addressed: Gmail's cursor row if you're navigating with `j`/`k`, or the row under the pointer if you last moved the mouse — a pointer left sitting somewhere never overrides the keyboard. In an open conversation, Alt+N edits its note in place. Alt combos never collide with Gmail's own single-key shortcuts.
- **`j`/`k` and `↑`/`↓` follow your order — in Labs.** By default Gmail's cursor walks its own date order, so in a shelved label it appears to jump around. `labs.cursor` fixes it by steering Gmail's *own* cursor through the order you see: one cursor, still Gmail's, so `Enter`, `e`, `#`, `r` all keep acting on the row you're looking at. If Gmail ever stops honoring the mechanism, Shelf hands the keys straight back rather than guessing. Enable at `options.html?labs=1`; background in [ARCHITECTURE.md](ARCHITECTURE.md).
- **Add a note:** hover a row → click the **note icon** → type → Esc. The note appears as a subtle gray chip right after the subject line in every list view (including the inbox) — quiet by default, since it's your private annotation; hover the chip to see the full note, click to edit. The editor supports **bold/italic/underline** (buttons or ⌘B/⌘I/⌘U), four opt-in emphasis colors (yellow/red/green/blue — the ∅ swatch returns a note to plain), a ✕ to delete the note, and **⌘/Ctrl+Enter to save & close**. URLs typed or pasted into a note become clickable links (new tab; http/https only), and **⌘/Ctrl+K** (or the 🔗 button) links the selected text — "sign the [permission slip] by Friday" instead of a raw URL. Picking a color also paints a slim matching edge on the thread's row, so urgency reads at a glance even where the chip is out of view. Inside an open conversation, a note icon sits in the toolbar (next to ⋮), and the note shows as a sticky-note strip under the subject — click it and it becomes editable **in place**, no popup.

Notes and groupings live in local extension storage (~10MB — effectively unlimited for this use) and are mirrored to Chrome sync so your other desktops pick them up. If your data outgrows sync's 100KB cap, Shelf keeps working locally and just skips the mirror. Nothing appears on mobile — that's the tradeoff for requiring zero email permissions.

**Backup:** right-click the Shelf icon in `chrome://extensions` → **Options** (or Details → Extension options) → Export/Import a JSON backup. Importing merges — newer items win, nothing gets deleted.

## Troubleshooting

- **Nothing appears:** make sure you're in the inbox or a label view (URL ends in `#inbox` or `#label/...`), and that the extension is enabled and the tab was reloaded after install.
- **Debug logging:** in Gmail's DevTools console run `localStorage.setItem('shelfDebug','1')` and reload. Logs are prefixed `[Shelf]`.
- **Gmail redesign broke something:** Gmail's markup changes periodically. Shelf uses defensive selectors with fallbacks, and if it can no longer read thread ids at all it shows a one-time "Shelf can't read Gmail's current layout" notice instead of silently disappearing. The fix is usually a one-line selector change in `content.js`.

## Limits (v0.5)

- Chrome desktop only; grouping shows in label views and the inbox (not in search results). With Priority Inbox / Multiple Inboxes, grouping attaches to the largest pane; Gmail's category tabs share the inbox's one section set.
- Cross-device mirroring uses Chrome sync (~100KB) — heavy users exceed it and simply lose the mirror, never local data. Oldest groupings auto-prune past 2,000.
- Sections are per-label (your "IGNITE" section in Action is separate from one in Pending), and per-account — each signed-in Gmail account (`/u/0/`, `/u/1/`, …) keeps its own sections.

## Roadmap ideas

- Optional Google Drive storage for notes (larger, portable)
- Optional sublabel sync (opt-in, requires Gmail OAuth — deliberately not in v1)
- Keyboard shortcuts
- Chrome Web Store packaging + licensing (ExtensionPay/LemonSqueezy) if productized

## Files

- `manifest.json` — MV3 manifest; only permission is `storage` + running on `mail.google.com`
- `content.js` — all Gmail-page logic (sections, drag & drop, notes, rendering)
- `shelf.css` — styling, light + dark theme
- `options.html` / `options.js` — the backup (export/import) page
- `popup.html` / `popup.js` — the toolbar-icon popup (how-to, shortcuts, links)
- `tools/gen_icons.py` — regenerates `icons/` (pure Python, no deps)
