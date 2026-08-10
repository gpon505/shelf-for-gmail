# YouTube — title & description for the demo video

Video: https://www.youtube.com/watch?v=rWH_V1yHUR8
Paste into YouTube Studio → Content → the video → Details.

Why this matters: the video is Public and searchable, so it's a standing
discovery channel — but right now it has no install link, so nobody who finds
it can act. The first two lines are all that show before "…more", which is why
the link goes first and the pitch second.

---

## Title (100-char limit)

```
Gmail sections & sticky notes — without giving an extension access to your account
```

Alternatives, if you want to test which pulls better. The first targets the
query people actually type; the second leads with the objection:

```
How to add sections to Gmail (and sticky notes on any email) — free Chrome extension
```

```
Every Gmail organizer wants your mailbox. This one never gets access to your account.
```

---

## Description

```
Add Shelf to Chrome (free): https://chromewebstore.google.com/detail/dgomdjjoogkknnggfbggcdnlogkhdpng

Shelf puts your own section headers inside Gmail — "Waiting on others", "This week", whatever you need — in any label, in the order you choose. Drag a thread where it belongs and it stays there. Stick a note on a conversation and it's waiting for you when you open it.

The part I care about: Shelf never gets access to your account. No sign-in, no OAuth grant, no Gmail API, no server. One permission — storage — and nothing leaves your browser. It can't send, archive, or delete mail, because it was never given the ability to.

Chrome will tell you at install that it can read and change your data on mail.google.com. That's true of every extension that draws anything into Gmail, this one included — it reads the thread list already on your screen. The difference is that nothing is transmitted anywhere, and there's a toggle that hides the whole overlay so you can see your plain, untouched Gmail in one click and check that for yourself.

Free for individuals, always. No trial, no locked features, no upsell.

CHAPTERS
0:00 The problem with labels
0:08 Making your first shelf
0:20 Dragging threads into place
0:34 Sticky notes on a conversation
0:48 Hiding Shelf to see plain Gmail

LINKS
Site: https://getshelf.email
How it compares to Sortd, Drag & Gmelius: https://getshelf.email/compare.html
Source code (GPL): https://github.com/gpon505/shelf-for-gmail
Privacy policy: https://getshelf.email/privacy.html
Support the project: https://ko-fi.com/getshelf

Not affiliated with or endorsed by Google. Gmail is a trademark of Google LLC.
```

⚠️ **Check the chapter timestamps against the real video before saving** — they're
written from `store/video-script.md`, not measured off the upload. YouTube only
renders chapters if the first one is `0:00` and there are at least three.

---

## Tags

```
gmail, gmail extension, gmail organization, inbox zero, gmail sections,
multiple inboxes, gmail productivity, email organization, chrome extension,
gmail tips, gmail labels, sticky notes
```

## Pinned comment

Post this yourself once the video has any traffic — it seeds the objection
answer before someone else raises it badly.

```
Happy to answer anything here. The most common question: "a content script can read the whole page, so how is this private?" Correct — and Chrome's install prompt says exactly that. The claim isn't that Shelf can't see the page it's drawing on; it's that it never gets access to your *account* (no OAuth, no Gmail API) and makes zero network requests, so nothing it sees can go anywhere. Source is public if you want to check: https://github.com/gpon505/shelf-for-gmail
```
