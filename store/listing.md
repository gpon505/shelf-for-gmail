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
• Sections ("shelves") inside the inbox and every label view — create, rename,
  collapse, drag-and-drop reorder
• Drag threads onto a shelf, or file several at once with multi-select
• Sticky notes on any thread — visible in the list, in the open conversation,
  and everywhere the thread appears
• Four note colors (red for urgent, etc.) — colored notes also paint a slim
  edge on the thread's row, so urgency reads at a glance
• Bold / italic / underline in notes; everything autosaves
• A movable "Everything else" section — drag it to the top for a triage-first
  inbox

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

Shelf is free. If it saves you ten minutes a week, there's a coffee link in
the extension options.

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

LIVE: `https://gpon505.github.io/shelf-for-gmail/privacy.html` — paste this
into the dashboard. (Landing page: `https://gpon505.github.io/shelf-for-gmail/`.)
Still to fill on the privacy page: your contact email.

## Assets checklist

- [ ] 1–5 screenshots, 1280×800 PNG — record from `tools/demo.html` (staged
      fake inbox; no real email on screen). Suggested five:
      1. Grouped label view, hero shot (sections + counts + a red-edged row)
      2. Drag mid-flight: row dimmed, shelf highlighted with plank line
      3. Note editor open (colors + B/I/U visible)
      4. Conversation view with the sticky strip under the subject
      5. Triage-first: "Everything else" on top
- [ ] Small promo tile 440×280 (logo on Keep-yellow background + one line:
      "Sections & notes for Gmail")
- [ ] Optional marquee 1400×560
- [ ] Store icon: `icons/icon128.png` (already in repo)

## URL placeholders to swap before shipping

- `options.html` — Ko-fi link (`YOUR_PAGE_HERE`) and privacy policy URL
- `content.js` — `DONATE_URL` constant near the top (the in-Gmail donation
  nudge stays dormant until this is a real Ko-fi URL)
- `store/site/index.html` — store URL, privacy URL, contact email

## Account setup reminders (you, once)

- $5 one-time developer registration fee, 2FA on the Google account
- Trader/non-trader declaration: donations-only ⇒ **non-trader**
- Add the privacy policy URL before submitting for review
