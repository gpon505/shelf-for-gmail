# Launch to-do — Greg's manual steps, in order

Everything code-side is done (v0.33.0, suite 34/34, release pipeline verified).
These are the steps only a human with accounts and a wallet can do.

## 1. Create the launch identity (~10 min)
- [ ] New Google account, e.g. `shelfforgmail@gmail.com`
      (the Web Store shows the publisher contact email PUBLICLY — don't use
      your personal one). Turn on 2FA — required for publishing.
      This one account covers: developer registration, public contact
      email, and the YouTube channel.

## 2. Chrome Web Store developer registration (~10 min)
- [ ] Signed in as that account: https://chrome.google.com/webstore/devconsole
- [ ] Pay the $5 one-time registration fee
- [ ] Publisher name: "Greg Ponikvar" (fits the story) — or "Shelf"
- [ ] Verify the contact email when prompted
- [ ] EU trader question: declare NON-TRADER (individual, not a business)

## 3. Ko-fi (~10 min)
- [ ] Create page at ko-fi.com — real photo for the avatar (faces out-earn
      logos on tip jars)
- [ ] ➜ SEND CLAUDE THE URL (goes into options, popup, and wakes the
      dormant donate nudge)

## 4. YouTube — DONE 2026-07-31
- [x] Channel "Shelf for Gmail" (@shelfforgmail) on shelfforgmail@gmail.com;
      banner, watermark, description, links all set
- [x] Uploaded `store/video/shelf-demo.mp4` as **Public** (better than the
      original Unlisted plan — search can find it)
- [x] Video link for the store listing's video field:
      https://www.youtube.com/watch?v=rWH_V1yHUR8

## 5. Contact email decision (~1 min)
- [ ] Probably just the new Gmail address
- [ ] ➜ TELL CLAUDE (goes into privacy policy, site footer, listing)

## 6. QA on your personal profile (~20 min + a day of living with it)
- [ ] chrome://extensions → ↻ reload Shelf → refresh Gmail
- [ ] Run store/qa-checklist.md — priority: split-view clicks open in the
      pane; classic clicks open the right email; sub-shelf drag in/out;
      checklists in notes
- [ ] Use it normally for a day or two. Anything weird → options →
      Copy Diagnostics → paste to Claude
- [ ] (Optional fun: options.html?labs=1 → flip on the Labs prototypes)

## 7. Submit (~30 min — after Claude swaps placeholders and bumps to v1.0.0)
- [ ] Devconsole → New item → upload the zip Claude builds (v1.0.0)
- [ ] Paste listing copy from store/listing.md
- [ ] Upload the 5 screenshots from store/screenshots/ + promo tiles
- [ ] Privacy tab: single purpose = "organize Gmail's thread list with
      user-created sections and notes"; storage-permission justification
      is in listing.md; data collected: NONE
- [ ] Add the YouTube link
- [ ] Visibility: **Unlisted** → Submit (first review takes a few days)

## 8. Friends week → public
- [ ] Share the unlisted link with friends; you + a couple of them leave
      the first reviews
- [ ] Flip to Public
- [ ] Post per store/launch-posts.md

The moment steps 3–5 are done, ping Claude with the three items
(Ko-fi URL · YouTube link · contact email) — placeholder swap, v1.0.0
bump, and the final zip happen the same hour.
