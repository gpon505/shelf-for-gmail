# Shelf launch video — script & recording guide

Target: 55 seconds, screen capture only, no voiceover required (captions carry
it — most feeds autoplay muted). Record over `tools/demo.html` — staged fake
emails, zero privacy risk, and every interaction is the real extension.

## Setup

1. Start the fixture server (VS Code / Claude Code: launch config
   `shelf-fixture`), open `http://localhost:8123/tools/demo.html`.
2. Browser window exactly **1280×800** (matches store screenshot size; crops
   clean to 16:9). Hide bookmarks bar. 100% zoom. Light theme.
3. macOS: System Settings → Accessibility → Display → larger cursor (one notch).
4. Record with QuickTime/Screen Studio/CapCut. Move the mouse slowly and
   deliberately — the speed of the *feature* is the pitch, not the cursor.
5. Do each beat as its own take; cut together after.

## Beats

**Beat 1 — the problem (0:00–0:08)**
Show the demo list as-is but scroll-flick once.
Caption: "Gmail labels organize email into folders. Then the folder is just… another pile."

**Beat 2 — shelves (0:08–0:25)**
Click the ＋ in the toolbar → type "Waiting on others" → Enter.
Drag the Laura Chen row onto the shelf — linger half a beat on the blue plank
highlight before dropping. Drag one more (Delta Dental).
Caption: "Make a shelf. Drag threads onto it. That's the whole learning curve."

**Beat 3 — notes & urgency (0:25–0:40)**
Hover Laura Chen row → note icon → type "promised reply by Friday" → click the
red swatch → Esc. Show the red chip and the red row edge. Collapse the section,
expand it.
Caption: "Stick a note on anything. Red means don't let it slip."

**Beat 4 — triage-first (0:40–0:48)**
Drag the "Everything else" header to the top.
Caption: "New mail on top. Your shelves below. Inbox zero, minus the willpower."

**Beat 5 — the kicker (0:48–0:55)**
Cut to a plain slide (white text on #1f1f1f):
"Shelf never touches your email.
**It can't.**
No Gmail access. No account. Free."
Then the store link + logo.

## Cuts to export

- Full 55s, 1080p MP4 → store listing video + Reddit/HN comments
- 20s GIF (beats 2–3 only, 800px wide) → post embeds, README
- Optional 9:16 crop of beats 2–3 + kicker → Shorts/Reels if ever wanted

## One honesty note

The demo page is a staged lookalike, not Gmail. That's the right call for
privacy, but don't pass it off as Gmail in *screenshots that claim to be
screenshots* — the store screenshots should either use this staged set (fine,
it shows real extension behavior) or a real Gmail account created fresh for
demos. Never record your real inbox.
