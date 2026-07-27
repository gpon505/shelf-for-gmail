# Shelf — design guidelines

One page. If a decision contradicts this file, one of them is wrong — decide
which, then update the loser.

## The vibe in one sentence

**Native or nothing**: Shelf should feel like a feature Google shipped and
forgot to announce — inside Gmail *and* everywhere the brand appears.

## Brand

- **The mark**: three horizontal bars, the third one short — a shelf seen
  side-on. Bars are near-black `#202124` on Keep-yellow `#fdd663`, or
  standalone in the current ink color. Never redraw it, never add elements,
  never rotate it.
- **The one-liner**: “The Gmail organizer that **can’t** read your email.”
  The word *can’t* is the brand. Architecture, not promise.
- **Voice**: a person, not a company. First person singular in the story,
  plain sentences, honest caveats stated out loud (“notes don’t appear on
  phones; that’s the tradeoff”). Never “we’re excited to announce.”
- **Name**: Shelf. Features use the furniture metaphor when it’s free
  (shelves, side walls, brackets) and plain words when it isn’t.

## Color

| Token | Light | Dark | Use |
|---|---|---|---|
| ink | `#202124` | `#e3e3e3` | text, the mark |
| muted | `#5f6368` | `#9aa0a6` | secondary text |
| line | `#e8eaed` | `#3c4043` | hairlines, borders |
| accent | `#1a73e8` | `#8ab4f8` | CTAs, selection, focus — Gmail’s blue, nothing else’s |
| paper | `#feefc3` / ink `#7c5e10` | `#4c4738` / `#fdd663` | the Keep-yellow family: notes, privacy callouts, welcome |
| card | `#f8f9fa` | `#28292c` | raised surfaces |

Feature palette (shelves/notes): yellow, red, green, blue (+ gray for
shelves, plain for notes). **Never a color picker. Never a sixth color.**
Color never carries meaning alone — always paired with a word or a name.

## Type

- Stack: `-apple-system, 'Google Sans', Roboto, Helvetica, Arial` for
  headlines; same with `'Google Sans Text'` preference for body.
- Scale (site): h1 48/1.12, h2 32/1.25, body 17/1.65, captions 15,
  fine print 13. Letter-spacing −0.5px on display sizes only.
- In-Gmail UI copies Gmail’s own metrics at runtime — never hardcodes them.

## Space

Base unit **8px**. Everything vertical is a multiple.

- Site section rhythm: **96px** between section content blocks (survives any
  refactor: measure heading-to-previous-content, not padding declarations).
- Card padding 24; grid gaps 20–24; caption-to-image 16.
- **The check**: screenshot any section boundary; if the gap between two
  sections isn’t obviously ≥ 2× the gap inside a section, it’s a bug.

## Imagery

- Screenshots are staged lookalikes with fictional people — never real mail,
  never claimed to be Gmail itself. Always rendered through the real
  extension code so behavior on screen is genuine.
- 2× resolution, light theme by default, one idea per image.
- Personas make examples: an inbox that could belong to a specific human
  (an educator, a seller, a GTD person) beats a generic demo.

## Motion

- 180ms, `cubic-bezier(.2,0,0,1)`, translate/opacity only.
- Every animation has a `prefers-reduced-motion` off-switch.
- Motion explains (where a thing went); it never decorates.

## Product rules (settled — don’t relitigate)

- No settings page. No color picker. No telemetry, ever.
- Subtle beats discoverable: hover-revealed controls over persistent chrome.
  When a control is “hard to find,” improve the tooltip or onboarding copy
  before adding UI — and stage a screenshot before shipping new chrome.
- One permission (`storage`). The day Shelf needs a server, Shelf is done.
- Fail safe: when Gmail changes, degrade silently and say so in a banner —
  never break email, never guess.

## The vibe check

Before shipping anything visual, ask:
1. Could a screenshot of this pass as a Gmail feature?
2. Is the space around it a multiple of 8, and generous?
3. Does color mean something, or is it decoration?
4. Would Greg call it clutter? (When in doubt: yes, remove it.)
