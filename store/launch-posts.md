# Launch posts — ready to paste

Ordered by expected value. Personalize the bracketed bits; keep your own voice
where mine reads too polished.

---

## 1. Show HN — scheduled Tue 18 Aug 2026, 1:00pm PT

➜ **Paste from `store/hn-post.txt`, not from here.** That file is this same post
formatted for HN's actual renderer — no markdown, blank lines between bullets so
they don't collapse into one paragraph — with the GitHub link added to the body
(this section said to include it but never did). Here is where the wording and
the prepared answers live; that file is what you paste.

**Title (80-char limit):**
Show HN: Shelf – Gmail sections and notes, with no access to your Gmail account

**Body:**

I live in Gmail — tight inbox, labels for everything — and kept hitting the
same wall: a label is just a smaller pile. I wanted section headers inside a
label ("Waiting on others", "This week"), drag-and-drop, and a sticky note on
a conversation. Every existing tool (Sortd, Drag, Gmelius…) wants full-mailbox
OAuth to do that. Reading, sending, and deleting rights, to draw headings on a
list, felt like a wildly disproportionate trade. So I built it for myself;
friends saw my inbox and told me to publish it.

So Shelf is built as a page-overlay only:

- One content script on mail.google.com, one permission (`storage`). No Gmail
  API, no OAuth, no server, no analytics.
- Sections, thread groupings, and notes live in chrome.storage.local, with
  chrome.storage.sync as a best-effort mirror across your desktops.
- It draws in Gmail's own visual language (metrics copied off Gmail's real
  toolbar buttons at runtime, so it survives density changes).
- It has no way to send, archive, or delete mail, and nothing is ever
  transmitted — zero network requests. The only thing it "reads" is the thread
  list already rendered on your screen; the interesting design constraint was
  building useful email workflow on top of nothing but the DOM and thread ids.
- There's a toggle that hides the whole overlay: one click shows your plain,
  untouched Gmail (as if uninstalled), one click brings your organization
  back. It exists because the trust claim should be checkable in one click,
  not taken on faith.

Honest limitations: Chrome desktop only; it's coupled to Gmail's markup
(defensive selectors + a canary banner if Google ships a redesign); notes
don't appear on mobile — that's the price of zero email permissions.

Free for individuals, no account: https://chromewebstore.google.com/detail/dgomdjjoogkknnggfbggcdnlogkhdpng
60-second demo: https://www.youtube.com/watch?v=XhEBsh0UAzE

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
- *"A content script can still read the whole DOM, including opened
  messages"* → Correct, and Chrome's install prompt says so — that's why the
  claim is scoped to account access and transmission, not page access: no
  OAuth/API means nothing beyond the rendered page, and zero network requests
  means nowhere for anything to go. The code is small enough to audit that in
  a few minutes.
- *"Firefox?"* → storage API is compatible; it's on the list if there's demand.
- *"Where's the code?"* → It's open (GPL-3.0):
  https://github.com/gpon505/shelf-for-gmail — include this link in the post
  body itself; it's the strongest trust signal you have.

---

## 2. Reddit

### r/SideProject / r/chrome_extensions launch post

**Title:** I built a Gmail organizer that never asks for email access — no OAuth, nothing leaves your browser

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

**Subject:** A Gmail extension that never asks for email access (free, 60s video inside)

Hi [Name],

Loved your [specific recent video/issue — name it, one sentence why]. I made
something your audience might genuinely use: Shelf adds your own section
headers and sticky notes inside Gmail — inbox-zero people use it to track
"waiting on" and stage projects without leaving the inbox.

The angle that might interest you editorially: it's built with **zero
email-account access**. No OAuth, no API, no server — it never touches your
mailbox and nothing leaves the browser, unlike every other Gmail organizer. 60-second demo: https://www.youtube.com/watch?v=XhEBsh0UAzE

It's free, no account. Happy to answer anything or do nothing further — no
follow-up sequence coming, promise.

[Your name]

*(Send 10–15, personally. Targets: channels/newsletters covering inbox zero,
GTD, Gmail tips, Chrome extensions roundups. One genuine sentence of
personalization beats everything else in this email.)*

---

## 4. Product Hunt (lowest priority — do it in week 2 with reviews as social proof)

**Tagline (60 chars):** Sections & sticky notes in Gmail — zero account access

**Description:** Shelf adds your own section headers inside Gmail's inbox and
labels — drag threads onto shelves, stick colored notes on conversations, and
reach inbox zero without another app. Built as a pure page overlay: no OAuth,
no Gmail API, no server. Nothing leaves your browser.

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
