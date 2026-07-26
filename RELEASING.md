# Releasing Shelf — the process

Every store upload follows this. It exists so fixes ship fast *without*
shipping regressions, and so every published version traces to an exact,
publicly auditable commit.

## Golden rules (non-negotiable)

1. **Zero new permissions, ever.** A permission change disables the extension
   for every user until they re-approve. Any feature that needs one is out of
   scope by definition.
2. **No third-party code in shipped files.** Shelf has zero dependencies —
   that is the security posture. Most extension compromises arrive through a
   dependency or a bought-out maintainer. Nothing in `content.js`,
   `options.js`, or `popup.js` may come from a package or CDN.
3. **Every store upload is built from a tagged, CI-green commit on `main`.**
   Never upload a zip built from uncommitted local changes.
4. **Account security is release security.** The Chrome Web Store developer
   account and GitHub account both keep 2FA on. Extension hijacks in the wild
   are nearly always account takeovers, not code exploits.

## Routine release (a fix or small improvement)

1. Make the change; add or update a test in `tools/test.html` that covers it.
2. Push to `main` → CI must be green (syntax, 19+ tests in headless Chrome, build).
3. Self-test in real Gmail: refresh the unpacked extension, reload the tab,
   exercise the changed behavior plus one minute of normal use.
4. For anything touching Gmail's DOM or drag/click behavior: run the relevant
   section of `store/qa-checklist.md`.
5. Bump `version` in `manifest.json` (patch for fixes, minor for features).
6. Commit, push, then tag: `git tag v1.0.1 && git push --tags`.
   The Release workflow re-runs the suite and attaches the zip to a GitHub
   Release — that zip is what you upload.
7. Upload to the Chrome Web Store dashboard → submit. Review is usually hours
   to a day for permission-stable updates. Users auto-update silently; open
   tabs show the "reload this tab" banner on their next edit.

## Hotfix (Gmail changed markup, something is broken for users)

Same steps, compressed: reproduce → consult ARCHITECTURE.md's coupling map →
fix (usually a one-line selector) → test in real Gmail → tag → upload.
Optics matter: reply to any store review or GitHub issue that reported it
("fixed in vX.Y.Z, rolling out now") — a fast fix visibly handled converts a
1-star report into a 5-star edit.

## Rollback ("the new version is worse")

The store has no rollback button. The play: check out the last good tag,
bump the version ABOVE the bad one (users only update forward), build, upload.

```
git checkout vX.Y.Z          # last good
# bump manifest version to X.Y.(Z+2 or higher than the bad release)
./tools/build.sh
# upload, then git checkout main and fix forward
```

## Contributor PRs (public repo)

- CI must pass, and read every line of the diff yourself — especially
  anything touching `fetch`, URLs, permissions, or the storage layer.
  The threat model is a helpful-looking PR that adds exfiltration.
- Selector fixes from users are gold; feature PRs get the design-principles
  test from ARCHITECTURE.md before code review.

## Cadence

- Bug fixes: ship as soon as green — small and often is the safety mechanism,
  since each release changes little and auto-update reaches everyone in hours.
- Features (post-freeze): batch behind a minor version; run the full QA
  checklist; consider a day of self-use before tagging.
- Ship when you can watch for a few hours afterward; the first signal of a
  bad release is a spike in the GitHub issues / store reviews you're watching
  anyway.
