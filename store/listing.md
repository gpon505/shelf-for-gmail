# Chrome Web Store listing — Shelf

Everything below maps 1:1 to fields in the developer dashboard. Paste as-is,
tweak voice where you like.

## Name

Shelf — sections & notes for Gmail

## Short description (132-char limit — this one is 127)

Group Gmail threads under your own section headers. Add sticky notes & colors. Zero access to your email — it can't read it.

## Detailed description

The Gmail organizer that can't read your email.

Labels tell you what an email is. Shelf tells you what to do next. Add your
own section headers inside any Gmail label view or the inbox, drag threads
onto them, and stick a private note on any conversation — all rendered in
Gmail's own visual language, like the feature was always there.

WHAT IT DOES
• Sections ("shelves") inside the inbox and every label view — like Multiple
  Inboxes, but for any label. Create, rename, color, collapse, drag to reorder
• Sub-shelves: nest one shelf inside another ("This week" → "Parents"), drag
  in and out — an indented chip in the parent's color shows the nesting
• Your order: drag threads into the sequence you'll actually work them in —
  within a shelf, between shelves, wherever
• Drag threads onto a shelf, or file several at once with multi-select
• Sticky notes on any thread — visible in the list, in the open conversation,
  and everywhere the thread appears
• Rich notes: bold / italic / underline, links (⌘K), bulleted and numbered
  lists, and checkboxes you can tick right on the note. Long notes collapse.
  Everything autosaves
• Note colors (red for urgent, etc.) — colored notes also paint a slim edge
  on the thread's row, so urgency reads at a glance
• A movable "Everything else" section — drag it to the top for a triage-first
  inbox
• Works with Gmail's reading pane (vertical and horizontal splits), dark
  mode, and custom themes
• Keyboard-first if you want it: Alt+N note, Alt+M move, Alt+↑/↓ reorder,
  Alt+S hide/show, ⌘⇧8/7/9 lists and checklists — Docs muscle memory
• Accessible by design: full keyboard support, screen-reader labels, reduced-
  motion support, and colorblind-friendly — color never carries meaning alone

WHAT IT CAN'T DO — BY DESIGN
Shelf is a page-level extension. It requests NO Gmail account access:
• No OAuth grant, no Gmail API, no server anywhere
• It cannot read, send, archive, delete, or label your email
• Your sections and notes live in your browser's extension storage (synced
  across your desktops by Chrome itself), and never leave it
• No analytics, no tracking, no account, no sign-up
• Uninstall it and Gmail is exactly as it was

WHO IT'S FOR
Inbox-zero people, GTD people, and anyone whose labels have become piles:
track who you're waiting on, stage a job search (Applied / Interviewing /
Offer), run a house purchase, keep school-and-family admin sane, give every
client a shelf of their own, or build an Eisenhower matrix (Urgent &
Important / Schedule / Delegate / Someday) right inside your inbox. Built by
an educator drowning in parent and student email — and battle-tested by a
spouse whose inbox eats things.

Shelf is free forever — I'll never charge for it. If it earns a place in
your day, the options page has a link where you can donate whatever that
turned out to be worth to you.

—
Not affiliated with or endorsed by Google. Gmail is a trademark of Google LLC.

## Category

Productivity → Workflow & Planning

## Language

English

## Single-purpose statement (dashboard privacy tab)

Shelf adds user-defined section headers and private notes to Gmail's thread
list pages. All functionality serves that one purpose.

## Permission justifications

- `storage` — saves the user's section names, thread groupings, and notes in
  chrome.storage (local, with Chrome sync used as a best-effort mirror).
  Nothing is transmitted anywhere else.
- Host access `https://mail.google.com/*` (content script) — required to draw
  Shelf's section headers, buttons, and note chips inside the Gmail page the
  user is viewing. The extension runs no code anywhere else and makes no
  network requests.

## Data-usage form answers

- Collects user data? **No** for every category (no PII, no financial/health
  info, no authentication info, no personal communications, no location, no
  web history, no user activity, no website content collected or transmitted).
  User-created notes are stored on-device via chrome.storage only.
- Remote code? **No.**
- Certify: data is not sold, not used for unrelated purposes, not used for
  creditworthiness. ✓ all three.

## Privacy policy URL

LIVE: `https://getshelf.email/privacy.html` — paste this
into the dashboard. (Landing page: `https://getshelf.email/`.)
Contact email on the privacy page: shelfforgmail@gmail.com — done.

## Assets checklist

- [x] 5 screenshots, 1280×800 PNG — DONE, in `store/screenshots/`
      (generated from `tools/shot-*.html` staged pages; no real email):
      1. `1-hero.png` — grouped label, sub-shelf, colored notes
      2. `2-drag.png` — drag mid-flight: source dimmed, target shelf planked
      3. `3-note-editor.png` — editor open: checklist, full toolbar, swatches
      4. `4-conversation.png` — sticky checklist strip under the subject
      5. `5-triage-first.png` — "Everything else" dragged to the top
      Regenerate any time: serve repo root, screenshot the tools/shot-* pages
      at 1280×800 (see git log for the exact command)
- [ ] Small promo tile 440×280 (logo on Keep-yellow background + one line:
      "Sections & notes for Gmail")
- [ ] Optional marquee 1400×560
- [ ] Store icon: `icons/icon128.png` (already in repo)

## URL placeholders — status

- Ko-fi (ko-fi.com/getshelf): DONE everywhere; donate nudge armed
- Contact email (shelfforgmail@gmail.com): DONE everywhere
- Chrome Store URL: the ONE remaining placeholder — exists only after first
  submission; swap into docs/index.html + popup review link then

## Account setup reminders (you, once)

- $5 one-time developer registration fee, 2FA on the Google account
- Trader/non-trader declaration: donations-only ⇒ **non-trader**
- Add the privacy policy URL before submitting for review
