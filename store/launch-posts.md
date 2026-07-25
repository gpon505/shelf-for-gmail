# Launch posts — ready to paste

Ordered by expected value. Personalize the bracketed bits; keep your own voice
where mine reads too polished.

---

## 1. Show HN (post the morning after store approval, ~6–8am PT weekday)

**Title (80-char limit):**
Show HN: Shelf – Gmail sections and notes, built so it can't read your email

**Body:**

I wanted section headers inside Gmail labels — group the threads for a project
under my own headings, stick a "waiting on Laura" note on a conversation — but
every existing tool (Sortd, Drag, Gmelius…) wants full-mailbox OAuth to do it.
That felt like a wildly disproportionate trade.

So Shelf is built as a page-overlay only:

- One content script on mail.google.com, one permission (`storage`). No Gmail
  API, no OAuth, no server, no analytics.
- Sections, thread groupings, and notes live in chrome.storage.local, with
  chrome.storage.sync as a best-effort mirror across your desktops.
- It draws in Gmail's own visual language (metrics copied off Gmail's real
  toolbar buttons at runtime, so it survives density changes).
- Architecturally it *cannot* read, send, archive, or delete mail — the
  interesting design constraint was building useful email workflow on top of
  nothing but the DOM and thread ids.

Honest limitations: Chrome desktop only; it's coupled to Gmail's markup
(defensive selectors + a canary banner if Google ships a redesign); notes
don't appear on mobile — that's the price of zero email permissions.

Free, no account: [store link]

**Prepared answers for likely comments:**

- *"Gmail redesign will break it"* → Yes, that's the standing risk of any
  DOM-level Gmail tool. Mitigations: defensive selectors with fallbacks,
  runtime metric-copying instead of hardcoded pixel values, and a canary that
  tells users plainly when it's broken instead of failing silently. Historically
  these fixes are one-line selector changes.
- *"Why not the Gmail API with readonly scope?"* → Even readonly is
  full-content access, and label-write (the obvious sync feature) means the
  extension could modify your mailbox. The entire product bet is that the
  permission blast radius should be zero.
- *"Firefox?"* → storage API is compatible; it's on the list if there's demand.
- *"Where's the code?"* → [decide before posting: open-source it or say
  "considering it" — HN strongly rewards a repo link]

---

## 2. Reddit

### r/SideProject / r/chrome_extensions launch post

**Title:** I built a Gmail organizer with zero email access — it literally can't read your mail

**Body:**
Gmail labels organize email into folders… and then the folder is just another
pile. I wanted my own section headers *inside* a label ("Waiting on others",
"This week"), drag-and-drop, and sticky notes on threads.

Every existing tool wants full Gmail OAuth for this. Mine uses none: one
content script, `storage` permission, nothing leaves the browser. Uninstall it
and Gmail is untouched.

[20s GIF]

Free on the Chrome store: [link]. Would love brutal feedback on the drag UX.

### r/gmail evergreen answer (for the weekly "how do I group emails in a label?" threads)

Gmail can't do sections natively — closest built-in is Multiple Inboxes, which
groups by *search query*, not by hand-picking threads. If you want to drag
threads under your own headers inside a label, I built a small free extension
for exactly this (disclosure: mine). It works without any Gmail account
access — no OAuth, just draws on the page: [link]

*(Etiquette: only post this in threads genuinely asking for it, always with
the disclosure, and answer the actual question first. One per thread, never
repeat in the same subreddit within a week — mods and voters can smell a
campaign instantly.)*

---

## 3. Creator outreach email (productivity YouTubers / newsletter writers)

**Subject:** A Gmail extension that can't read your email (free, 55s video inside)

Hi [Name],

Loved your [specific recent video/issue — name it, one sentence why]. I made
something your audience might genuinely use: Shelf adds your own section
headers and sticky notes inside Gmail — inbox-zero people use it to track
"waiting on" and stage projects without leaving the inbox.

The angle that might interest you editorially: it's built with **zero email
access**. No OAuth, no API, no server — architecturally it can't read mail,
unlike every other Gmail organizer. 55-second demo: [video link]

It's free, no account. Happy to answer anything or do nothing further — no
follow-up sequence coming, promise.

[Your name]

*(Send 10–15, personally. Targets: channels/newsletters covering inbox zero,
GTD, Gmail tips, Chrome extensions roundups. One genuine sentence of
personalization beats everything else in this email.)*

---

## 4. Product Hunt (lowest priority — do it in week 2 with reviews as social proof)

**Tagline (60 chars):** Sections & sticky notes in Gmail — zero email access

**Description:** Shelf adds your own section headers inside Gmail's inbox and
labels — drag threads onto shelves, stick colored notes on conversations, and
reach inbox zero without another app. Built as a pure page overlay: no OAuth,
no Gmail API, no server. It can't read your email.

**Maker first comment:** the origin story — you wanted sections in labels for
family/school/work admin, refused to grant mailbox access to get them, built
the overlay instead. End with the one question you actually want feedback on
(e.g., "what would make you trust — or never trust — a Gmail extension?").

---

## Timing plan

- Day 0: store approval → soft launch: r/SideProject post + first outreach emails
- Day 1–2: Show HN (be online all day; answer everything, fast and humbly)
- Ongoing: r/gmail answers as threads appear (set a weekly search reminder)
- Week 2+: Product Hunt with review count as proof; second outreach wave
