// Shelf — sections & notes for Gmail (v0.1)
// Runs only on mail.google.com. No Gmail API, no OAuth, no background access.
// Sections + assignments + notes live in chrome.storage.sync (never in your mailbox).
(() => {
  'use strict';
  if (window.__shelfLoaded) return;
  window.__shelfLoaded = true;

  const DEBUG = (() => {
    try { return localStorage.getItem('shelfDebug') === '1'; } catch (e) { return false; }
  })();
  const log = (...a) => { if (DEBUG) console.log('[Shelf]', ...a); };

  // append a failure record to a local ring buffer (never transmitted);
  // users can copy it from the options page into bug reports
  function recordDiag(msg) {
    try {
      const ver = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '?';
      chrome.storage.local.get({ diag: [] }, (r) => {
        const d = Array.isArray(r.diag) ? r.diag : [];
        d.push(new Date().toISOString() + ' v' + ver + ' ' + String(msg).slice(0, 400));
        chrome.storage.local.set({ diag: d.slice(-40) });
      });
    } catch (e) { /* context dead — nothing to record to */ }
  }

  // ---------------------------------------------------------------- svg ----
  const SVG = {
    chevron: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    // Toolbar glyphs are authored on a 20-viewBox so a 20px render maps 1:1 to
    // the pixel grid. The old 24-viewBox at 20px put every bar on fractional
    // rows — zero crisp pixels, a two-row ~80% smear that read darker and
    // muddier than Gmail's neighbors. Line recipe measured from Gmail's own
    // 20dp assets (filter_list, reorder): one full-alpha row + one half-alpha
    // shoulder (an effective 1.5px stroke), 14px long.
    shelf: '<svg viewBox="0 0 20 20"><path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h9v1.5H3v-1.5z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm17.7-2.12c.39.39.39 1.02 0 1.41l-.71.71-2.12-2.12.71-.71c.39-.39 1.02-.39 1.41 0l.71.71zm-3.54.71 2.12 2.12-5.3 5.29H12v-2.12l5.16-5.29z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 5.5 12.7 4.1 14.1 9 19 20 8l-1.4-1.4z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
    listUl: '<svg viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>',
    listOl: '<svg viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>',
    checkbox: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm0 16H5V5h14v14zm-1.99-10-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>',
    // the shelf mark with a small plus tucked where the short bar ends —
    // "add to Shelf" reads as one brand, not a second icon language
    shelfEye: '<svg viewBox="0 0 20 20"><path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h6v1.5H3v-1.5z"/><g transform="scale(.83333)"><path d="M18 14.6c1.9 0 3.6 1.06 4.45 2.75a4.98 4.98 0 01-8.9 0A4.98 4.98 0 0118 14.6zm0 1.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/></g></svg>',
    shelfEyeOff: '<svg viewBox="0 0 20 20"><path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h6v1.5H3v-1.5z"/><g transform="scale(.83333)"><path d="M18 14.6c1.9 0 3.6 1.06 4.45 2.75a5 5 0 01-1.42 1.74l-4.9-4.13c.57-.23 1.2-.36 1.87-.36zm-3.7.66l5.9 4.97c-.66.28-1.4.42-2.2.42-1.9 0-3.6-1.06-4.45-2.75.2-.4.45-.76.75-1.09l-.86-.72.86-.83z"/></g></svg>',
    shelfPlus: '<svg viewBox="0 0 20 20"><path d="M3 4h14v1.5H3V4zm0 5h14v1.5H3V9zm0 5h6v1.5H3v-1.5z"/><path d="M16 11h-2v3h-3v2h3v3h2v-3h3v-2h-3v-3z"/></svg>'
  };

  // -------------------------------------------------------------- state ----
  // sections:    { [label]: { list: [{id, name, collapsed}], elseCollapsed } }
  // assignments: { [threadId]: { s: sectionId, t: timestamp } }
  // notes:       { [threadId]: { text, t } }   (stored as individual 'note:<id>' keys)
  let sections = {};
  let assignments = {};
  let notes = {};
  let labs = {}; // dormant experimental features; options.html?labs=1 toggles
  let shelfHidden = false; // the overlay is off; Gmail shows exactly as it ships
  let shelfHiddenT = 0;     // when that was decided — echoes older than this are stale
  // Hidden state travels as {v, t}. It is the codebase's one true TOGGLE: every
  // other boolean here is monotonic (hintDone can only become true), so a
  // late-arriving sync echo can't regress them. A toggle CAN regress — sset
  // mirrors to chrome.storage.sync, whose writes land seconds later, and the
  // echo of a previous flip would silently undo the user's click. Newest-wins
  // by timestamp, the same rule assignments already live by. Accepts the plain
  // booleans written before this record existed.
  const hiddenRec = (x) => {
    if (x && typeof x === 'object') return { v: !!x.v, t: x.t || 0 };
    return { v: !!x, t: 0 };
  };
  let rules = []; // labs.rules: [{id, label, s, from}] — auto-file by sender

  // storage.local (~10MB) is the source of truth; storage.sync (100KB cap) is
  // a best-effort mirror for cross-device use. If sync overflows, Shelf keeps
  // working from local and only the mirror is skipped.
  const aget = (areaName, keys) => new Promise((res) => {
    try { chrome.storage[areaName].get(keys, (v) => res(v || {})); } catch (e) { res({}); }
  });
  const sset = (obj) => new Promise((res) => {
    try {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Shelf] save failed:', chrome.runtime.lastError.message);
          recordDiag('save failed: ' + chrome.runtime.lastError.message);
        }
        res();
      });
    } catch (e) { markContextDead(); res(); }
    try {
      chrome.storage.sync.set(obj, () => {
        if (chrome.runtime.lastError) log('sync mirror skipped:', chrome.runtime.lastError.message);
      });
    } catch (e) { /* mirror only */ }
  });
  const sremove = (k) => new Promise((res) => {
    try { chrome.storage.local.remove(k, res); } catch (e) { markContextDead(); res(); }
    try { chrome.storage.sync.remove(k, () => { void chrome.runtime.lastError; }); } catch (e) {}
  });

  // After a store auto-update, this orphaned script keeps running but its
  // chrome.storage is dead — without a warning, edits silently stop saving
  // (the classic "extension lost my data" 1-star). The DOM APIs still work,
  // so we can at least tell the user to reload.
  let contextDead = false;
  let deadEl = null;
  let deadDismissed = false;

  function markContextDead() {
    if (contextDead) return;
    contextDead = true;
    // expected after every store auto-update — the banner informs the user;
    // keep the console quiet so chrome://extensions "Errors" stays clean
    log('extension context invalidated — showing reload banner');
    scheduleRender();
  }

  // returns the overlay element to slot at the top of the list, or null.
  // (All banners are overlay DIVs — see the pristine-tbody rule at headers.)
  function updateDeadBanner() {
    if (!contextDead || deadDismissed) { if (deadEl && deadEl.isConnected) deadEl.remove(); return null; }
    if (!deadEl) {
      deadEl = el('div', 'shelf-hint');
      deadEl.innerHTML =
        '<div class="shelf-hint-b shelf-warn">' + SVG.shelf +
        '<span>Shelf was updated in the background — <b>reload this tab</b> so your changes keep saving.</span>' +
        '<span class="shelf-hint-x" title="Dismiss">✕</span></div>';
      const x = deadEl.querySelector('.shelf-hint-x');
      a11y(x, 'Dismiss');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        deadDismissed = true;
        deadEl.remove();
        scheduleRender();
      });
    }
    return deadEl;
  }

  // union of local and sync: newer item wins; sections travel as one object
  // versioned by sectionsRev
  function mergeStates(loc, syn) {
    const out = {};
    const lRev = loc.sectionsRev || 0;
    const sRev = syn.sectionsRev || 0;
    const lHas = loc.sections && Object.keys(loc.sections).length;
    const sHas = syn.sections && Object.keys(syn.sections).length;
    if (sHas && (!lHas || sRev > lRev)) { out.sections = syn.sections; out.sectionsRev = sRev; }
    else { out.sections = loc.sections || {}; out.sectionsRev = lRev; }
    const a = {};
    const la = loc.assignments || {};
    const sa = syn.assignments || {};
    for (const k of Object.keys(la)) a[k] = la[k];
    for (const k of Object.keys(sa)) {
      if (!a[k] || (sa[k].t || 0) > (a[k].t || 0)) a[k] = sa[k];
    }
    out.assignments = a;
    for (const src of [loc, syn]) {
      for (const k of Object.keys(src)) {
        if (k.indexOf('note:') !== 0) continue;
        if (!out[k] || (src[k].t || 0) > (out[k].t || 0)) out[k] = src[k];
      }
    }
    out.hintDone = !!(loc.hintDone || syn.hintDone);
    out.fileCount = Math.max(loc.fileCount || 0, syn.fileCount || 0);
    out.fileDays = Array.from(new Set((loc.fileDays || []).concat(syn.fileDays || []))).slice(-60);
    if (loc.reviewDone || syn.reviewDone) out.reviewDone = true;
    const hl = hiddenRec(loc.shelfHidden);
    const hs = hiddenRec(syn.shelfHidden);
    out.shelfHidden = hs.t > hl.t ? hs : hl;
    out.labs = loc.labs || syn.labs || {};
    out.rules = Array.isArray(loc.rules) ? loc.rules
      : (Array.isArray(syn.rules) ? syn.rules : []);
    if (loc.donateDone || syn.donateDone) out.donateDone = true;
    const fu = [loc.firstUse, syn.firstUse].filter(Boolean);
    if (fu.length) out.firstUse = Math.min.apply(null, fu);
    return out;
  }

  async function loadState() {
    const loc = await aget('local', null);
    const syn = await aget('sync', null);
    const all = mergeStates(loc, syn);
    sections = all.sections || {};
    assignments = all.assignments || {};
    // existing users who already made a section don't need the first-run hint
    hintDone = !!all.hintDone ||
      Object.keys(sections).some((k) => sections[k].list && sections[k].list.length);
    fileCount = all.fileCount || 0;
    fileDays = Array.isArray(all.fileDays) ? all.fileDays : [];
    reviewDone = !!all.reviewDone;
    donateDone = !!all.donateDone;
    firstUse = all.firstUse || 0;
    if (!firstUse) {
      firstUse = Date.now();
      sset({ firstUse });
    }
    labs = all.labs || {};
    const hr = hiddenRec(all.shelfHidden);
    shelfHidden = hr.v;
    shelfHiddenT = hr.t;
    rules = Array.isArray(all.rules) ? all.rules : [];
    notes = {};
    for (const k of Object.keys(all)) {
      if (k.indexOf('note:') === 0) notes[k.slice(5)] = all[k];
    }
    // make local complete (adopts anything that only lived in sync, e.g. on
    // first run after the local-first migration or on a second device)
    try { chrome.storage.local.set(all, () => { void chrome.runtime.lastError; }); } catch (e) {}
    log('state loaded', { labels: Object.keys(sections), assignments: Object.keys(assignments).length, notes: Object.keys(notes).length });
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      // local: other Gmail tabs and the options page; sync: other devices
      if (area !== 'sync' && area !== 'local') return;
      for (const k of Object.keys(changes)) {
        const ch = changes[k];
        if (k === 'sections') sections = ch.newValue || {};
        else if (k === 'assignments') assignments = ch.newValue || {};
        else if (k === 'hintDone') hintDone = hintDone || !!ch.newValue;
        else if (k === 'fileCount') fileCount = Math.max(fileCount, ch.newValue || 0);
        else if (k === 'fileDays') fileDays = Array.isArray(ch.newValue) ? ch.newValue : fileDays;
        else if (k === 'firstUse') firstUse = firstUse && ch.newValue ? Math.min(firstUse, ch.newValue) : (ch.newValue || firstUse);
        else if (k === 'reviewDone') reviewDone = reviewDone || !!ch.newValue;
        else if (k === 'labs') labs = ch.newValue || {};
        else if (k === 'shelfHidden') {
          const hr = hiddenRec(ch.newValue);
          if (hr.t >= shelfHiddenT) { shelfHidden = hr.v; shelfHiddenT = hr.t; }
        }
        else if (k === 'rules') rules = Array.isArray(ch.newValue) ? ch.newValue : [];
        else if (k === 'donateDone') donateDone = donateDone || !!ch.newValue;
        else if (k.indexOf('note:') === 0) {
          if (ch.newValue) notes[k.slice(5)] = ch.newValue;
          else delete notes[k.slice(5)];
        }
      }
      scheduleRender();
    });
  } catch (e) { /* extension context gone */ }

  const saveSections = () => sset({ sections, sectionsRev: Date.now() });

  async function saveAssignments() {
    const keys = Object.keys(assignments);
    if (keys.length > 2000) {
      keys
        .map((k) => [k, (assignments[k] && assignments[k].t) || 0])
        .sort((a, b) => a[1] - b[1])
        .slice(0, keys.length - 1800)
        .forEach((pair) => { delete assignments[pair[0]]; });
      log('pruned old assignments');
    }
    await sset({ assignments });
  }

  async function saveNote(threadId, text, color, html) {
    text = (text || '').trim();
    if (text) {
      const fold = notes[threadId] && notes[threadId].fold; // survives edits
      notes[threadId] = { text, t: Date.now() };
      if (color) notes[threadId].c = color; // absent = plain (subtle gray)
      // keep the rich version only when it actually carries formatting
      if (html && html.indexOf('<') !== -1) notes[threadId].h = html;
      if (fold) notes[threadId].fold = 1;
      await sset({ ['note:' + threadId]: notes[threadId] });
    } else {
      delete notes[threadId];
      await sremove('note:' + threadId);
    }
  }

  // ------------------------------------------------------- dom helpers ----
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // make one of our span/div controls keyboard- and screen-reader-usable
  function a11y(node, label, action) {
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    if (label) node.setAttribute('aria-label', label);
    node.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      if (action) action(); else node.click();
    });
  }

  // Each signed-in Gmail account (/mail/u/0/, /mail/u/1/, …) keeps its own
  // sections. Account 0 uses unprefixed keys (existing data stays valid);
  // others are namespaced with a NUL separator no label name can contain.
  function accountPrefix() {
    const m = location.pathname.match(/\/u\/(\d+)\//);
    const idx = m ? m[1] : '0';
    return idx === '0' ? '' : 'u' + idx + '\u0000';
  }

  function currentLabel() {
    // the inbox is a pseudo-label; ':inbox' can't collide with a real label name
    if (/^#inbox(\/|\?|$)/.test(location.hash) || location.hash === '' || location.hash === '#') {
      return accountPrefix() + ':inbox';
    }
    // stop at a raw "/" — that's a thread id suffix; slashes inside nested
    // label names are %2F-encoded and survive this
    const m = location.hash.match(/^#label\/([^/?]+)/);
    if (!m) return null;
    try {
      return accountPrefix() + decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch (e) {
      return accountPrefix() + m[1];
    }
  }

  function labelCfg(label, create) {
    let c = sections[label];
    if (!c && create) c = sections[label] = { list: [], elseCollapsed: false };
    return c || { list: [], elseCollapsed: false };
  }

  // section ids in display order with ':else' placed at cfg.elseAt
  // (default: bottom). "Everything else" is movable but not removable.
  function combinedIds(cfg) {
    // TOP-LEVEL ids only; cfg.list is flat but canonical (a parent is
    // immediately followed by its sub-shelves, one level max via s.p)
    const ids = cfg.list.filter((s) => !s.p).map((s) => s.id);
    const at = Math.min(Math.max(cfg.elseAt == null ? ids.length : cfg.elseAt, 0), ids.length);
    ids.splice(at, 0, ':else');
    return ids;
  }

  function childrenOf(cfg, id) {
    return cfg.list.filter((s) => s.p === id);
  }

  function visibleThreadTable() {
    let best = null;
    let bestCount = 0;
    const tables = document.querySelectorAll('table.F');
    for (const t of tables) {
      if (!t.offsetParent) continue; // hidden view container
      const n = t.querySelectorAll('tr.zA').length;
      if (n > bestCount) { best = t; bestCount = n; }
    }
    return best;
  }

  function threadIdOf(row) {
    let n = row.querySelector('[data-legacy-thread-id]');
    if (n) return n.getAttribute('data-legacy-thread-id');
    n = row.querySelector('[data-thread-id]');
    if (n) {
      const v = n.getAttribute('data-thread-id') || '';
      return v.replace(/^#?thread-[a-z]?:/, '') || null;
    }
    return null;
  }

  function subjectOf(row) {
    const n = row.querySelector('span.bog');
    return n ? n.textContent.trim() : '(conversation)';
  }

  // ------------------------------------------------------------ headers ----
  // PRISTINE-TBODY RULE (load-bearing — do not regress): Gmail resolves a
  // clicked row to a thread by the row's DOM index among ALL <tr>s in the
  // tbody, counting display:none ones. Any foreign <tr> Shelf inserts — or
  // any reordering/removal of Gmail's rows — shifts that mapping for every
  // row below it: clicks open the WRONG thread, and rows pushed past the
  // list's length go dead. Proven live 2026-07-28. Therefore headers and
  // banners are absolutely-positioned DIVs in an overlay beside the table,
  // and grouping is drawn purely with translateY transforms on Gmail's own
  // rows. The tbody's children and their order are never touched.
  const headerEls = new Map(); // keyed by hkey(label, sectionId)
  // NUL separator: labels may contain spaces, so ' ' would be ambiguous
  const hkey = (label, sectionId) => label + '\u0000' + sectionId;

  function headerFor(label, sectionId) {
    const key = hkey(label, sectionId);
    let hd = headerEls.get(key);
    if (hd) return hd;
    hd = el('div', 'shelf-header');
    hd.dataset.shelfSection = sectionId;
    hd.dataset.shelfLabel = label;
    hd.innerHTML =
      '<div class="shelf-h">' +
      '<span class="shelf-chevron">' + SVG.chevron + '</span>' +
      '<span class="shelf-h-pill">' +
      '<span class="shelf-name"></span>' +
      '<span class="shelf-count"></span>' +
      '</span>' +
      // ⋮ sits right beside the pill, where the label is — not shoved to the
      // far right. The spacer follows it and eats the remaining width.
      '<span class="shelf-more">' + SVG.dots + '</span>' +
      '<span class="shelf-spacer"></span>' +
      '</div>';

    const h = hd.querySelector('.shelf-h');
    a11y(h);
    h.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(hd.dataset.shelfLabel, hd.dataset.shelfSection);
    });
    h.addEventListener('mousedown', (e) => startHeaderDrag(e, hd));
    const more = hd.querySelector('.shelf-more');
    a11y(more, 'Section options');
    attachGTip(more, 'Section options');
    more.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      openHeaderMenu(hd.dataset.shelfLabel, hd.dataset.shelfSection, more.getBoundingClientRect());
    });

    headerEls.set(key, hd);
    return hd;
  }

  function updateHeader(tr, name, count, collapsed, isElse, color) {
    tr.classList.toggle('shelf-else', !!isElse);
    tr.classList.toggle('shelf-collapsed', !!collapsed);
    for (const c of NOTE_COLORS) {
      tr.classList.toggle('shelf-hc-' + c, color === c);
    }
    const n = tr.querySelector('.shelf-name');
    const c = tr.querySelector('.shelf-count');
    if (!n || !c) return; // recycled/emptied node — next render rebuilds it
    n.textContent = name;
    c.textContent = count ? String(count) : '';
    const h = tr.querySelector('.shelf-h');
    if (h) {
      h.setAttribute('aria-expanded', String(!collapsed));
      h.setAttribute('aria-label', name + ' section, ' + (count || 0) + ' conversations');
    }
  }

  // The overlay: one absolutely-positioned container per visible table,
  // aligned to the table's box inside its (position:relative) parent. All
  // Shelf headers and banners live here — never in the tbody.
  let ovEl = null;
  let lastTable = null; // remembered so cleanup can reset margin/transforms

  function ensureOverlay(table) {
    const host = table.parentElement;
    if (!host) return null;
    if (!ovEl) ovEl = el('div', 'shelf-ov');
    if (ovEl.parentElement !== host) host.appendChild(ovEl);
    if (getComputedStyle(host).position === 'static') host.classList.add('shelf-ovhost');
    // align the overlay's coordinate space to the table's border box
    ovEl.style.left = table.offsetLeft + 'px';
    ovEl.style.top = table.offsetTop + 'px';
    ovEl.style.width = table.clientWidth + 'px';
    lastTable = table;
    return ovEl;
  }

  function clearRowTransforms() {
    // sweep by inline style, not a marker class — Gmail rewrites row class
    // attributes wholesale, which would strip any marker and strand the row
    // visually displaced after sections are removed
    document.querySelectorAll('tr.zA').forEach((r) => {
      if (r.style.transform) { r.style.transform = ''; r.style.transition = ''; }
    });
  }

  function cleanupHeaders() {
    for (const hdEl of headerEls.values()) {
      if (hdEl.isConnected) hdEl.remove();
    }
    document.querySelectorAll('tr.zA.shelf-hidden').forEach((r) => r.classList.remove('shelf-hidden'));
    clearRowTransforms();
    if (lastTable) lastTable.style.marginBottom = '';
    if (ovEl && ovEl.isConnected && !ovEl.childElementCount) ovEl.remove();
    lastSeq = null;
  }

  // Walk the visual sequence top-to-bottom: overlay DIVs get absolute tops,
  // Gmail's TRs get translateY deltas from their natural layout position.
  // Idempotent — every write is guarded — and it never touches the tbody.
  let lastSeq = null; // previous visual sequence, for change detection

  function layoutVisual(table, tbody, seqEls, wantAnim) {
    const ov = ensureOverlay(table);
    if (!ov) return;
    // overlay membership: exactly the DIVs of this sequence
    const want = new Set();
    for (const n of seqEls) { if (n.tagName === 'DIV') want.add(n); }
    for (const child of Array.prototype.slice.call(ov.children)) {
      if (!want.has(child)) child.remove();
    }
    for (const n of seqEls) {
      if (n.tagName === 'DIV' && n.parentElement !== ov) ov.appendChild(n);
    }
    const anim = wantAnim && !reducedMotion();
    let y = tbody.offsetTop; // rows' natural origin within the table
    for (const n of seqEls) {
      if (n.tagName === 'DIV') {
        const t = y + 'px';
        if (n.style.top !== t) n.style.top = t;
        y += n.offsetHeight;
      } else {
        if (n.classList.contains('shelf-hidden')) {
          if (n.style.transform) n.style.transform = '';
          continue;
        }
        const dy = y - n.offsetTop;
        const t = dy ? 'translateY(' + dy + 'px)' : '';
        if (n.style.transform !== t) {
          if (anim) glideRow(n);
          n.style.transform = t;
        }
        y += n.offsetHeight;
      }
    }
    // the transforms extend the visual list past the table's layout height —
    // grow the table's margin so the scroll area covers the overhang
    const extra = Math.max(0, (y - tbody.offsetTop) - tbody.offsetHeight);
    const m = extra ? extra + 'px' : '';
    if (table.style.marginBottom !== m) table.style.marginBottom = m;
  }

  // rows glide between slots by transitioning their transform change
  const glided = new Set();
  function glideRow(r) {
    r.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
    if (glided.has(r)) return;
    glided.add(r);
    setTimeout(() => { r.style.transition = ''; glided.delete(r); }, 400);
  }

  // Drag a section header to reorder sections. A thin insertion line shows
  // where the section will land; a plain click still toggles collapse.
  // the insertion indicator is a fixed-position overlay (like the drag ghost)
  // so Gmail's table styling can never swallow it
  let insLineEl = null;

  function showInsLine(rect) {
    if (!insLineEl) {
      insLineEl = el('div', 'shelf-insline');
      document.body.appendChild(insLineEl);
    }
    insLineEl.style.left = (rect.left + 10) + 'px';
    insLineEl.style.width = Math.max(80, rect.width - 40) + 'px';
    insLineEl.style.top = (rect.top + 1) + 'px';
  }

  function hideInsLine() {
    if (insLineEl) { insLineEl.remove(); insLineEl = null; }
  }

  function startHeaderDrag(e, tr) {
    if (e.button !== 0) return;
    const label = tr.dataset.shelfLabel;
    const secId = tr.dataset.shelfSection; // ':else' is draggable too
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;
    let dimmed = null; // the section's rows, dimmed while it's in hand
    let liftedKids = null; // sub-shelf headers lifted along with a parent
    let beforeId = null; // entry id we'd insert before; ':end' = very bottom
    let nestId = null; // top-level shelf we'd drop INTO (Finder-style)
    let nestEl = null;
    let outBefore = null; // sub-shelf out-dent: top-level slot we'd move to
    let hdrScroller = null;

    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        dragging = true;
        document.body.classList.add('shelf-dragging');
        tr.classList.add('shelf-lift');
        dimmed = [];
        liftedKids = [];
        const cfg0 = labelCfg(label, false);
        // a parent carries its sub-shelves: dim their rows, lift their headers
        const carried = new Set([secId]);
        for (const k of childrenOf(cfg0, secId)) {
          carried.add(k.id);
          const kh = headerEls.get(hkey(label, k.id));
          if (kh && kh.isConnected) { kh.classList.add('shelf-lift'); liftedKids.push(kh); }
        }
        const tb = visibleThreadTable();
        if (tb) {
          const known = new Set(cfg0.list.map((s) => s.id));
          for (const r of tb.querySelectorAll('tr.zA')) {
            const id = threadIdOf(r);
            const a = id && assignments[id];
            const inSec = a && known.has(a.s) ? a.s : ':else';
            if (carried.has(inSec)) { r.classList.add('shelf-drag-src'); dimmed.push(r); }
          }
        }
        ghost = el('div', 'shelf-ghost shelf-ghost-sec');
        ghost.innerHTML = SVG.shelf + '<span></span>';
        ghost.querySelector('span').textContent = tr.querySelector('.shelf-name').textContent;
        document.body.appendChild(ghost);
        hdrScroller = scrollParentOf(visibleThreadTable() || tr);
      }
      if (!dragging) return;
      ghost.style.left = (ev.clientX + 12) + 'px';
      ghost.style.top = (ev.clientY + 10) + 'px';
      const cfg = labelCfg(label, false);
      const dragSec = cfg.list.find((x) => x.id === secId);
      const parentId = dragSec ? dragSec.p : null;
      // Finder-style nesting: the middle band of another top-level header is
      // a "drop into" target; its top/bottom edges still mean reorder. One
      // level max, so a shelf with sub-shelves of its own (or ':else') can
      // only reorder.
      let overNest = null;
      if (dragSec && childrenOf(cfg, secId).length === 0) {
        for (const id of combinedIds(cfg)) {
          if (id === ':else' || id === secId || id === parentId) continue;
          const h = headerEls.get(hkey(label, id));
          if (!h || !h.isConnected) continue;
          const r = h.getBoundingClientRect();
          if (ev.clientY >= r.top + r.height * 0.3 &&
              ev.clientY <= r.top + r.height * 0.7) { overNest = id; break; }
        }
      }
      if (overNest !== nestId) {
        if (nestEl) nestEl.classList.remove('shelf-nest-target');
        nestId = overNest;
        nestEl = nestId ? headerEls.get(hkey(label, nestId)) : null;
        if (nestEl) nestEl.classList.add('shelf-nest-target');
      }
      if (nestId) {
        hideInsLine();
        outBefore = null;
        autoScrollUpdate(hdrScroller, ev.clientY);
        return;
      }
      // out-dent: while dragging a sub-shelf, the top edge of any top-level
      // header is a "become a top-level shelf here" slot (full-width line,
      // vs the indented line of sibling reorders)
      outBefore = null;
      if (parentId) {
        for (const id of combinedIds(cfg)) {
          const h = headerEls.get(hkey(label, id));
          if (!h || !h.isConnected) continue;
          const r = h.getBoundingClientRect();
          if (ev.clientY >= r.top && ev.clientY < r.top + r.height * 0.3) {
            outBefore = id;
            showInsLine({ top: r.top - 1, left: r.left, width: r.width });
            break;
          }
        }
        if (outBefore) { autoScrollUpdate(hdrScroller, ev.clientY); return; }
      }
      // sub-shelves reorder among their siblings; top-level moves as a block
      const slotIds = parentId
        ? childrenOf(cfg, parentId).map((x) => x.id)
        : combinedIds(cfg);
      beforeId = ':end';
      for (const id of slotIds) {
        const h = headerEls.get(hkey(label, id));
        if (!h || !h.isConnected) continue;
        const r = h.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { beforeId = id; break; }
      }
      let rect = null;
      if (beforeId !== secId) {
        if (beforeId === ':end') {
          if (parentId) {
            // the boundary after the last sibling = whatever entry follows
            const tops = combinedIds(cfg);
            const nextTop = tops[tops.indexOf(parentId) + 1];
            const nh = nextTop ? headerEls.get(hkey(label, nextTop)) : null;
            if (nh && nh.isConnected) rect = nh.getBoundingClientRect();
          }
          if (!rect && addEl && addEl.isConnected) {
            rect = addEl.getBoundingClientRect();
          } else if (!rect) {
            const tb = visibleThreadTable();
            if (tb) {
              const tr2 = tb.getBoundingClientRect();
              rect = { top: tr2.bottom - 2, left: tr2.left, width: tr2.width };
            }
          }
        } else {
          const targetTr = headerEls.get(hkey(label, beforeId));
          if (targetTr && targetTr.isConnected) rect = targetTr.getBoundingClientRect();
        }
      }
      // sibling reorders draw an indented line, echoing the sub-shelf indent
      if (rect && parentId) {
        rect = { top: rect.top, left: rect.left + 24, width: Math.max(80, rect.width - 24) };
      }
      log('section drag', { secId, beforeId, found: !!rect });
      if (rect) showInsLine(rect); else hideInsLine();
      autoScrollUpdate(hdrScroller, ev.clientY);
    };

    const up = async () => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      document.removeEventListener('keydown', onKeyCancel, true);
      window.removeEventListener('blur', onBlurCancel);
      if (!dragging) return; // plain click — collapse toggle handles it
      autoScrollStop();
      document.body.classList.remove('shelf-dragging');
      tr.classList.remove('shelf-lift');
      if (liftedKids) {
        liftedKids.forEach((h) => h.classList.remove('shelf-lift'));
        liftedKids = null;
      }
      if (dimmed) {
        dimmed.forEach((r) => r.classList.remove('shelf-drag-src'));
        dimmed = null;
      }
      if (ghost) ghost.remove();
      hideInsLine();
      suppressNextClick();
      const droppedNest = nestId;
      const droppedOut = outBefore;
      nestId = null;
      outBefore = null;
      if (nestEl) { nestEl.classList.remove('shelf-nest-target'); nestEl = null; }
      const cfg = labelCfg(label, false);
      const dragSec = cfg.list.find((x) => x.id === secId);
      const parentId = dragSec ? dragSec.p : null;
      const secById = new Map(cfg.list.map((s) => [s.id, s]));
      if (droppedNest && dragSec) {
        // become (or move to) the last sub-shelf of the drop target
        const tops = combinedIds(cfg).filter((id) => id !== secId);
        dragSec.p = droppedNest;
        const flat = [];
        for (const id of tops) {
          if (id === ':else') continue;
          flat.push(secById.get(id));
          for (const k of childrenOf(cfg, id)) if (k.id !== secId) flat.push(k);
          if (id === droppedNest) flat.push(dragSec);
        }
        cfg.list = flat;
        cfg.elseAt = tops.indexOf(':else');
        await saveSections();
        requestAnimatedRender();
        return;
      }
      if (droppedOut && dragSec && parentId) {
        // out-dent: leave the parent, re-enter as a top-level shelf at the slot
        const ids = combinedIds(cfg); // before delete — else secId lands twice
        delete dragSec.p;
        let to = droppedOut === ':end' ? ids.length : ids.indexOf(droppedOut);
        if (to < 0) to = ids.length;
        ids.splice(to, 0, secId);
        const flat = [];
        for (const id of ids) {
          if (id === ':else') continue;
          flat.push(secById.get(id));
          for (const k of childrenOf(cfg, id)) flat.push(k);
        }
        cfg.list = flat;
        cfg.elseAt = ids.indexOf(':else');
        await saveSections();
        requestAnimatedRender();
        return;
      }
      if (beforeId === secId) return;
      if (parentId) {
        // reorder among siblings, then rebuild the flat canonical list
        const sibs = childrenOf(cfg, parentId).map((x) => x.id);
        const from = sibs.indexOf(secId);
        if (from < 0) return;
        let to = beforeId === ':end' ? sibs.length : sibs.indexOf(beforeId);
        if (to < 0) return;
        sibs.splice(from, 1);
        if (to > from) to--;
        if (to === from) return;
        sibs.splice(to, 0, secId);
        const flat = [];
        for (const s of cfg.list) {
          if (s.p === parentId) continue;
          flat.push(s);
          if (s.id === parentId) for (const id2 of sibs) flat.push(secById.get(id2));
        }
        cfg.list = flat;
      } else {
        const ids = combinedIds(cfg);
        const from = ids.indexOf(secId);
        if (from < 0) return;
        let to = beforeId === ':end' ? ids.length : ids.indexOf(beforeId);
        if (to < 0) return;
        ids.splice(from, 1);
        if (to > from) to--;
        if (to === from) return; // ended up where it started — nothing to save
        ids.splice(to, 0, secId);
        // a top-level section moves as a block with its sub-shelves
        const flat = [];
        for (const id of ids) {
          if (id === ':else') continue;
          flat.push(secById.get(id));
          for (const k of childrenOf(cfg, id)) flat.push(k);
        }
        cfg.list = flat;
        cfg.elseAt = ids.indexOf(':else');
      }
      await saveSections();
      requestAnimatedRender();
    };

    const onKeyCancel = (ev) => {
      if (ev.key === 'Escape' && dragging) { ev.stopPropagation(); beforeId = secId; nestId = null; outBefore = null; up(); }
    };
    const onBlurCancel = () => { if (dragging) { beforeId = secId; nestId = null; outBefore = null; up(); } };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', up, true);
    document.addEventListener('keydown', onKeyCancel, true);
    window.addEventListener('blur', onBlurCancel);
  }

  async function toggleCollapse(label, sectionId) {
    const cfg = labelCfg(label, true);
    if (sectionId === ':else') {
      cfg.elseCollapsed = !cfg.elseCollapsed;
    } else {
      const s = cfg.list.find((x) => x.id === sectionId);
      if (!s) return;
      s.collapsed = !s.collapsed;
    }
    await saveSections();
    scheduleRender();
  }

  // ----------------------------------------------------------- sections ----
  const rid = () => Math.random().toString(36).slice(2, 7);

  async function createSection(label, name) {
    name = (name || '').trim();
    if (!name) return null;
    const cfg = labelCfg(label, true);
    const s = { id: rid(), name, collapsed: false };
    cfg.list.push(s);
    await saveSections();
    markHintDone();
    return s;
  }

  async function assignMany(tids, sectionId) {
    const now = Date.now();
    for (const tid of tids) assignments[tid] = { s: sectionId, t: now };
    fileCount += tids.length;
    const day = new Date().toISOString().slice(0, 10);
    if (fileDays.indexOf(day) === -1) {
      fileDays.push(day);
      if (fileDays.length > 60) fileDays = fileDays.slice(-60);
    }
    await saveAssignments();
    sset({ fileCount, fileDays });
    requestAnimatedRender();
    flashThreads(tids);
  }

  async function unassignMany(tids) {
    for (const tid of tids) delete assignments[tid];
    await saveAssignments();
    requestAnimatedRender();
    flashThreads(tids);
  }

  // A bucket's threads in on-screen order: unranked rows (never hand-placed
  // here) keep Gmail's order up front, then ranked rows by their rank. This is
  // the exact rule the renderer's orderBucket paints by, so anything that
  // reorders (drag drop, keyboard nudge) can agree with what's displayed
  // without depending on animation or geometry having settled. ':else' is a
  // real bucket: an unfiled row, or one pointing at a since-deleted section,
  // belongs to it and ranks just like a named section's rows.
  function bucketOrder(sectionId) {
    const tb = visibleThreadTable();
    if (!tb) return [];
    const cfg = labelCfg(currentLabel() || '', false);
    const secOf = (id) => {
      const a = assignments[id];
      return a && cfg.list.some((s) => s.id === a.s) ? a.s : ':else';
    };
    const unranked = [];
    const ranked = [];
    for (const row of tb.querySelectorAll('tr.zA')) {
      const id = threadIdOf(row);
      if (!id || secOf(id) !== sectionId) continue;
      const a = assignments[id];
      if (a && a.r != null && a.s === sectionId) ranked.push(id);
      else unranked.push(id);
    }
    ranked.sort((x, y) => assignments[x].r - assignments[y].r);
    return unranked.concat(ranked);
  }

  // place tids at a precise position inside a section (before beforeTid, or at
  // the end when beforeTid is null), renumbering the whole bucket so ranks stay
  // simple integers. The working order is the CURRENT on-screen order, so
  // renumbering preserves any existing hand-arrangement instead of snapping the
  // other threads back to Gmail's date order.
  async function assignManyAt(tids, sectionId, beforeTid) {
    const now = Date.now();
    const moving = new Set(tids);
    const order = bucketOrder(sectionId).filter((id) => !moving.has(id));
    let at = beforeTid ? order.indexOf(beforeTid) : -1;
    if (at < 0) at = order.length;
    order.splice.apply(order, [at, 0].concat(tids));
    order.forEach((id, i) => {
      const prev = assignments[id] || {};
      assignments[id] = {
        s: sectionId,
        t: moving.has(id) ? now : (prev.t || now),
        r: (i + 1) * 1000
      };
    });
    fileCount += tids.length;
    const day = new Date().toISOString().slice(0, 10);
    if (fileDays.indexOf(day) === -1) {
      fileDays.push(day);
      if (fileDays.length > 60) fileDays = fileDays.slice(-60);
    }
    await saveAssignments();
    sset({ fileCount, fileDays });
    requestAnimatedRender();
    flashThreads(tids);
  }

  // ------------------------------------------------------------ overlay ----
  let overlayEl = null;
  let overlayCleanup = null;

  function closeOverlay() {
    if (overlayCleanup) { try { overlayCleanup(); } catch (e) {} overlayCleanup = null; }
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function openOverlay(node, x, y, onClose) {
    tipHide();
    closeOverlay();
    overlayEl = node;
    overlayCleanup = onClose || null;
    document.body.appendChild(node);
    // clamp to viewport
    const r = node.getBoundingClientRect();
    let left = Math.min(x, window.innerWidth - r.width - 12);
    let top = Math.min(y, window.innerHeight - r.height - 12);
    node.style.left = Math.max(8, left) + 'px';
    node.style.top = Math.max(8, top) + 'px';
  }

  document.addEventListener('mousedown', (e) => {
    if (overlayEl && !overlayEl.contains(e.target)) closeOverlay();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl) { closeOverlay(); e.stopPropagation(); }
  }, true);
  document.addEventListener('scroll', (e) => {
    tipHide();
    gtipHide();
    if (overlayEl && !overlayEl.contains(e.target)) closeOverlay();
  }, true);

  function menuItem(text, opts) {
    opts = opts || {};
    const mi = el('div', 'shelf-mi');
    if (opts.icon) {
      const ic = el('span', 'shelf-mi-ic');
      ic.innerHTML = opts.icon;
      mi.appendChild(ic);
    } else {
      mi.appendChild(el('span', 'shelf-mi-sp'));
    }
    mi.appendChild(el('span', 'shelf-mi-t', text));
    if (opts.danger) mi.classList.add('shelf-danger');
    if (opts.sub) mi.classList.add('shelf-mi-sub');
    if (opts.onClick) {
      mi.addEventListener('click', (e) => { e.stopPropagation(); opts.onClick(mi, e); });
    }
    return mi;
  }

  function inlineInput(menu, placeholder, initial, onSubmit) {
    menu.textContent = '';
    const input = el('input', 'shelf-input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = initial || '';
    input.maxLength = 40;
    menu.appendChild(input);
    const hint = el('div', 'shelf-pop-hint', 'Enter to save · Esc to cancel');
    hint.style.padding = '0 14px 8px';
    menu.appendChild(hint);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = input.value; closeOverlay(); onSubmit(v); }
      else if (e.key === 'Escape') closeOverlay();
    });
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    setTimeout(() => input.focus(), 0);
  }

  // --------------------------------------------------------- assign menu ----
  // ------------------------------------------------------------- labs ----
  // Dormant experimental features, gated by the storage.local `labs` object
  // (toggled from options.html?labs=1). Nothing below renders or runs for
  // regular users until a flag is on.
  async function saveRules() {
    await sset({ rules });
  }

  function senderEmail(row) {
    const n = row.querySelector('[email]');
    return n ? String(n.getAttribute('email')).toLowerCase() : null;
  }

  // auto-file unassigned rows whose sender matches a rule for this label;
  // runs from render on data already on screen — no API, no fetching
  function applyRules(label, rows) {
    if (!labs.rules || !rules.length) return;
    const cfg = labelCfg(label, false);
    if (!cfg.list.length) return;
    const known = new Set(cfg.list.map((s) => s.id));
    let changed = 0;
    for (const row of rows) {
      const tid = threadIdOf(row);
      if (!tid || assignments[tid]) continue;
      const from = senderEmail(row);
      if (!from) continue;
      for (const r of rules) {
        if (r.label === label && known.has(r.s) && from.indexOf(r.from) !== -1) {
          assignments[tid] = { s: r.s, t: Date.now() };
          changed++;
          break;
        }
      }
    }
    if (changed) saveAssignments();
  }

  // labs.kits: one-click starter sets, offered wherever a section name
  // can be typed
  const LAB_KITS = [
    { name: 'Eisenhower', sections: ['Urgent & important', 'Schedule', 'Delegate', 'Someday'] },
    { name: 'Waiting-first', sections: ['Waiting on others', 'This week', 'Read later'] }
  ];

  function appendKits(menu, label) {
    if (!labs.kits || !label) return;
    menu.appendChild(el('div', 'shelf-sep'));
    menu.appendChild(el('div', 'shelf-cap', 'Kits'));
    for (const k of LAB_KITS) {
      menu.appendChild(menuItem(k.name + ' (' + k.sections.length + ')', {
        onClick: async () => {
          closeOverlay();
          for (const nm of k.sections) await createSection(label, nm);
          scheduleRender();
        }
      }));
    }
  }

  function createRuleFrom(tid, label, section) {
    const n = document.querySelector('[data-legacy-thread-id="' + tid + '"]');
    const row = n && n.closest ? n.closest('tr.zA') : null;
    const from = row && senderEmail(row);
    if (!from) {
      showInfoToast('Couldn’t read a sender address to make a rule from.');
      return;
    }
    const rule = { id: rid(), label, s: section.id, from };
    rules.push(rule);
    saveRules();
    showUndoToast('Auto-file rule: ' + from + ' → ' + section.name, () => {
      rules = rules.filter((x) => x.id !== rule.id);
      saveRules();
    });
  }

  function openAssignMenuFor(tids, rect, above) {
    const label = currentLabel();
    if (!label || !tids.length) return;
    const cfg = labelCfg(label, false);
    const single = tids.length === 1 ? tids[0] : null;
    const cur = single && assignments[single] && assignments[single].s;
    const curKnown = cur && cfg.list.some((s) => s.id === cur);

    const menu = el('div', 'shelf-menu');
    if (cfg.list.length) {
      const cap = el('div', 'shelf-cap', single ? 'Move to' : 'Move ' + tids.length + ' to');
      menu.appendChild(cap);
      for (const s of cfg.list) {
        menu.appendChild(menuItem(s.name, {
          icon: s.id === cur ? SVG.check : null,
          sub: !!s.p,
          onClick: (mi, ev) => {
            closeOverlay();
            // labs: ⌥-click a section = also create an auto-file rule for
            // this thread's sender
            if (labs.rules && ev && ev.altKey && single) createRuleFrom(single, label, s);
            assignMany(tids, s.id);
          }
        }));
      }
      menu.appendChild(menuItem(cfg.elseName || 'Everything else', {
        icon: single && !curKnown ? SVG.check : null,
        onClick: () => { closeOverlay(); unassignMany(tids); }
      }));
      menu.appendChild(el('div', 'shelf-sep'));
    }
    menu.appendChild(menuItem('New section…', {
      icon: SVG.plus,
      onClick: () => {
        inlineInput(menu, 'Section name', '', async (v) => {
          const s = await createSection(label, v);
          if (s) assignMany(tids, s.id);
        });
        appendKits(menu, label);
      }
    }));
    openOverlay(menu, rect.left - 180, rect.bottom + 6);
    if (above && overlayEl === menu) {
      const r = menu.getBoundingClientRect();
      menu.style.top = Math.max(8, rect.top - r.height - 8) + 'px';
      menu.style.left = Math.max(8, Math.min(rect.left - 40, window.innerWidth - r.width - 12)) + 'px';
    }
  }

  function openAssignMenu(row, rect) {
    const tid = threadIdOf(row);
    if (tid) openAssignMenuFor([tid], rect);
  }

  // --------------------------------------------------------- header menu ----
  function openHeaderMenu(label, sectionId, rect) {
    const cfg = labelCfg(label, false);
    if (sectionId === ':else') {
      // the catch-all can be renamed, never removed
      const menu = el('div', 'shelf-menu');
      menu.appendChild(el('div', 'shelf-cap', 'Default section — unfiled threads land here'));
      menu.appendChild(menuItem('Rename', {
        onClick: () => {
          inlineInput(menu, 'Everything else', cfg.elseName || 'Everything else', async (v) => {
            v = (v || '').trim();
            const c2 = labelCfg(label, true);
            if (!v || v === 'Everything else') delete c2.elseName;
            else c2.elseName = v;
            await saveSections();
            scheduleRender();
          });
        }
      }));
      if (cfg.elseName) {
        menu.appendChild(menuItem('Reset to “Everything else”', {
          onClick: async () => {
            closeOverlay();
            const c2 = labelCfg(label, true);
            delete c2.elseName;
            await saveSections();
            scheduleRender();
          }
        }));
      }
      menu.appendChild(el('div', 'shelf-sep'));
      menu.appendChild(el('div', 'shelf-cap', 'Shelf color'));
      const elseSw = el('div', 'shelf-menu-sw');
      elseSw.appendChild(makeSwatches(cfg.elseColor || null, async (c) => {
        const c2 = labelCfg(label, true);
        if (c) c2.elseColor = c; else delete c2.elseColor;
        await saveSections();
        scheduleRender();
      }, true));
      menu.appendChild(elseSw);
      openOverlay(menu, rect.left - 160, rect.bottom + 4);
      return;
    }
    const idx = cfg.list.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const s = cfg.list[idx];

    const menu = el('div', 'shelf-menu');
    menu.appendChild(menuItem('Rename', {
      onClick: () => {
        inlineInput(menu, 'Section name', s.name, async (v) => {
          v = (v || '').trim();
          if (v) { s.name = v; await saveSections(); scheduleRender(); }
        });
      }
    }));
    if (!s.p) {
      menu.appendChild(menuItem('Add sub-shelf…', {
        icon: SVG.plus,
        onClick: () => {
          inlineInput(menu, 'Sub-shelf name', '', async (v) => {
            v = (v || '').trim();
            if (!v) return;
            // insert after the parent's existing sub-shelves (canonical order)
            let at = cfg.list.findIndex((x) => x.id === sectionId) + 1;
            while (at < cfg.list.length && cfg.list[at].p === sectionId) at++;
            cfg.list.splice(at, 0, { id: rid(), name: v, collapsed: false, p: sectionId });
            await saveSections();
            scheduleRender();
          });
        }
      }));
    }
    if (s.p) {
      menu.appendChild(menuItem('Make top-level shelf', {
        onClick: async () => {
          closeOverlay();
          const parentId = s.p;
          delete s.p;
          cfg.list.splice(cfg.list.findIndex((x) => x.id === sectionId), 1);
          // re-enter as a top-level shelf right after its old family
          const tops = combinedIds(cfg);
          tops.splice(tops.indexOf(parentId) + 1, 0, sectionId);
          const byId = new Map(cfg.list.map((x) => [x.id, x]));
          const flat = [];
          for (const id of tops) {
            if (id === ':else') continue;
            if (id === sectionId) { flat.push(s); continue; }
            flat.push(byId.get(id));
            for (const k of childrenOf(cfg, id)) flat.push(k);
          }
          cfg.list = flat;
          cfg.elseAt = tops.indexOf(':else');
          await saveSections();
          scheduleRender();
        }
      }));
    }
    menu.appendChild(el('div', 'shelf-sep'));
    menu.appendChild(el('div', 'shelf-cap', 'Shelf color'));
    const secSw = el('div', 'shelf-menu-sw');
    secSw.appendChild(makeSwatches(s.c || null, async (c) => {
      if (c) s.c = c; else delete s.c;
      await saveSections();
      scheduleRender();
    }, true));
    menu.appendChild(secSw);
    if (labs.rules) {
      const mine = rules.filter((r) => r.label === label && r.s === sectionId);
      if (mine.length) {
        menu.appendChild(el('div', 'shelf-sep'));
        menu.appendChild(el('div', 'shelf-cap', 'Auto-file rules — click to remove'));
        for (const r of mine) {
          menu.appendChild(menuItem('✕  ' + r.from, {
            onClick: () => {
              rules = rules.filter((x) => x.id !== r.id);
              saveRules();
              closeOverlay();
              showInfoToast('Auto-file rule removed');
            }
          }));
        }
      }
    }
    menu.appendChild(el('div', 'shelf-sep'));
    let armed = false;
    menu.appendChild(menuItem('Remove section', {
      danger: true,
      onClick: async (mi) => {
        if (!armed) {
          armed = true;
          mi.querySelector('.shelf-mi-t').textContent = 'Remove — click to confirm';
          return;
        }
        closeOverlay();
        cfg.list.splice(cfg.list.findIndex((x) => x.id === sectionId), 1);
        // removing a parent promotes its sub-shelves rather than deleting them
        for (const k of cfg.list) if (k.p === sectionId) delete k.p;
        // drop assignments pointing at it (threads stay, just ungrouped)
        for (const k of Object.keys(assignments)) {
          if (assignments[k].s === sectionId) delete assignments[k];
        }
        await saveSections();
        await saveAssignments();
        scheduleRender();
      }
    }));
    openOverlay(menu, rect.left - 160, rect.bottom + 4);
  }

  // --------------------------------------------------------- note popover ----
  function openNotePopover(row, rect) {
    const tid = threadIdOf(row);
    if (tid) openNotePopoverFor(tid, rect);
  }

  const NOTE_COLORS = ['yellow', 'red', 'green', 'blue', 'gray'];
  // v0.14.0 dropped gray from the note picker ("plain already looks gray") —
  // and with the chip styled identically to plain, picking it truly did
  // nothing. Real use disagreed: a quiet-but-deliberate tier below the loud
  // colors is wanted. Gray is back, and its chip is now DARKER than plain so
  // choosing it visibly means something.

  // keep only b/i/u/br and safe http(s) links from edited note HTML; blocks
  // become <br>; bare URLs in plain text are auto-linkified at save time
  const URL_RE = /https?:\/\/[^\s<>"'\x00-\x1f]+/g;

  function appendLinkified(dst, s) {
    let last = 0;
    let m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s))) {
      let url = m[0];
      const trail = url.match(/[.,;:!?)\]]+$/); // "see https://x.com." — keep the period out
      if (trail) url = url.slice(0, -trail[0].length);
      if (m.index > last) dst.appendChild(document.createTextNode(s.slice(last, m.index)));
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = url;
      dst.appendChild(a);
      last = m.index + url.length;
    }
    if (last < s.length) dst.appendChild(document.createTextNode(s.slice(last)));
  }

  function sanitizeNoteHtml(html) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const out = document.createElement('div');
    let chars = 0;
    (function walk(src, dst, inA) {
      for (const n of src.childNodes) {
        if (chars >= 2000) return;
        if (n.nodeType === 3) {
          const s = String(n.nodeValue).slice(0, 2000 - chars);
          chars += s.length;
          if (inA) dst.appendChild(document.createTextNode(s));
          else appendLinkified(dst, s);
          continue;
        }
        if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
        if (n.tagName === 'BR') { dst.appendChild(document.createElement('br')); continue; }
        if (n.tagName === 'UL' || n.tagName === 'OL') {
          const l = dst.appendChild(document.createElement(n.tagName.toLowerCase()));
          walk(n, l, inA);
          if (!l.querySelector('li')) l.remove(); // empty list = noise
          continue;
        }
        if (n.tagName === 'LI') {
          const inList = dst.tagName === 'UL' || dst.tagName === 'OL';
          if (!inList && dst.lastChild && dst.lastChild.nodeName !== 'BR') {
            dst.appendChild(document.createElement('br'));
          }
          walk(n, inList ? dst.appendChild(document.createElement('li')) : dst, inA);
          continue;
        }
        if (n.tagName === 'INPUT') {
          if (String(n.getAttribute('type') || '').toLowerCase() === 'checkbox' && chars < 2000) {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            if (n.checked || n.hasAttribute('checked')) cb.setAttribute('checked', '');
            dst.appendChild(cb);
            chars += 1; // counts toward the cap so they can't be spammed
          }
          continue; // every other input type is dropped
        }
        if ((n.tagName === 'DIV' || n.tagName === 'P') && dst.lastChild && dst.lastChild.nodeName !== 'BR') {
          dst.appendChild(document.createElement('br'));
        }
        if (n.tagName === 'A' && !inA) {
          const href = n.getAttribute('href') || '';
          if (/^https?:\/\//i.test(href)) {
            const a = document.createElement('a');
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            dst.appendChild(a);
            walk(n, a, true);
            continue;
          }
          walk(n, dst, inA); // unsafe scheme: keep the text, drop the link
          continue;
        }
        const st = n.style || {};
        let target = dst;
        if (n.tagName === 'B' || n.tagName === 'STRONG' || st.fontWeight === 'bold' || +st.fontWeight >= 600) {
          target = target.appendChild(document.createElement('b'));
        }
        if (n.tagName === 'I' || n.tagName === 'EM' || st.fontStyle === 'italic') {
          target = target.appendChild(document.createElement('i'));
        }
        if (n.tagName === 'U' || String(st.textDecoration || '').indexOf('underline') !== -1) {
          target = target.appendChild(document.createElement('u'));
        }
        walk(n, target, inA);
      }
    })(doc.body, out, false);
    while (out.lastChild && out.lastChild.tagName === 'BR') out.lastChild.remove();
    return out.innerHTML;
  }

  // a toggled checkbox changes its .checked property, not its attribute —
  // sync before serializing innerHTML so what's saved is what's on screen
  function syncCheckboxAttrs(node) {
    for (const cb of node.querySelectorAll('input[type="checkbox"]')) {
      if (cb.checked) cb.setAttribute('checked', '');
      else cb.removeAttribute('checked');
    }
  }

  function renderNoteInto(node, note) {
    if (!node || !note) return;
    if (note.h) { if (node.innerHTML !== note.h) node.innerHTML = note.h; }
    else if (node.textContent !== note.text) node.textContent = note.text;
  }

  // Google-Docs-native list shortcuts inside the note editors:
  // ⌘⇧8 bullets · ⌘⇧7 numbers · ⌘⇧9 checklist. Returns true if handled.
  function fmtKey(e, host) {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return false;
    if (e.code === 'Digit8') document.execCommand('insertUnorderedList');
    else if (e.code === 'Digit7') document.execCommand('insertOrderedList');
    else if (e.code === 'Digit9') insertChecklistBox(host);
    else return false;
    return true;
  }

  // Where is the caret relative to a checklist? Walks backwards from the
  // caret to the start of its line. Returns null when the caret isn't a
  // collapsed selection inside host; otherwise {cb, between} — the checkbox
  // that starts the caret's line (or null) and the text between them.
  function caretChecklistInfo(host) {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!host || !host.contains(r.startContainer)) return null;
    let between = '';
    let n = r.startContainer;
    let cb = null;
    if (n.nodeType === 3) {
      between = String(n.nodeValue).slice(0, r.startOffset);
    } else if (n.childNodes.length && r.startOffset > 0) {
      n = n.childNodes[r.startOffset - 1];
      if (n.tagName === 'INPUT' && n.type === 'checkbox') cb = n;
      else between = n.textContent || '';
    }
    while (!cb && n && n !== host) {
      let p = n.previousSibling;
      let boundary = false;
      while (p) {
        if (p.nodeType === 1 && (p.tagName === 'BR' || /^(DIV|P|UL|OL|LI)$/.test(p.tagName))) { boundary = true; break; }
        if (p.nodeType === 1 && p.tagName === 'INPUT' && p.type === 'checkbox') { cb = p; break; }
        between = (p.textContent || '') + between;
        p = p.previousSibling;
      }
      if (cb || boundary) break;
      n = n.parentNode;
      if (n === host || (n && /^(DIV|P|LI)$/.test(n.tagName))) break; // line start
    }
    return { cb, between };
  }

  // ☑ button / ⌘⇧9: on a line that already starts with a checkbox this
  // means "next item". The break must come from insertParagraph — a literal
  // <br> in the insertHTML payload gets hoisted out of a <div> line by
  // Chrome, landing after the block's own break (the skipped-line bug).
  function insertChecklistBox(host) {
    const info = host ? caretChecklistInfo(host) : null;
    if (info && info.cb) document.execCommand('insertParagraph');
    document.execCommand('insertHTML', false, '<input type="checkbox">&nbsp;');
  }

  // Enter on a checkbox line continues the checklist (as native lists do);
  // Enter on an EMPTY checkbox line removes the box and ends the checklist,
  // matching Docs/Keep. Returns true when the key was handled.
  function checklistEnter(e, host) {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    const info = caretChecklistInfo(host);
    if (!info || !info.cb) return false;
    e.preventDefault();
    e.stopPropagation();
    if (!info.between.replace(/\s/g, '')) {
      // empty checkbox line — end the checklist: drop the box and its
      // spacer, and put the caret back where the box was. (Removing the
      // node the caret sits in strands the selection, and the next insert
      // then lands a line away — the "skips a line" bug.)
      const cb = info.cb;
      const keep = document.createRange();
      keep.setStartBefore(cb);
      keep.collapse(true);
      const spacer = cb.nextSibling;
      cb.remove();
      if (spacer && spacer.nodeType === 3 && !spacer.nodeValue.replace(/\s/g, '')) spacer.remove();
      const s2 = getSelection();
      s2.removeAllRanges();
      s2.addRange(keep);
    } else {
      document.execCommand('insertParagraph');
      document.execCommand('insertHTML', false, '<input type="checkbox">&nbsp;');
    }
    return true;
  }

  function makeFmtBar(onLink, getEd) {
    const bar = el('span', 'shelf-fmt');
    for (const pair of [['bold', 'B'], ['italic', 'I'], ['underline', 'U']]) {
      const cmd = pair[0];
      const lab = pair[1];
      const b = el('span', 'shelf-fmt-b shelf-fmt-' + cmd, lab);
      b.title = cmd.charAt(0).toUpperCase() + cmd.slice(1) + ' (⌘' + lab + ')';
      a11y(b, b.title);
      b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        try { document.execCommand('styleWithCSS', false, false); } catch (err) {}
        document.execCommand(cmd);
      });
      bar.appendChild(b);
    }
    bar.appendChild(el('span', 'shelf-fmt-sep'));
    for (const trip of [
      ['insertUnorderedList', SVG.listUl, 'Bulleted list (⌘⇧8)'],
      ['insertOrderedList', SVG.listOl, 'Numbered list (⌘⇧7)']
    ]) {
      const b = el('span', 'shelf-fmt-b shelf-fmt-list');
      b.innerHTML = trip[1];
      b.title = trip[2];
      a11y(b, trip[2]);
      b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        try { document.execCommand('styleWithCSS', false, false); } catch (err) {}
        document.execCommand(trip[0]);
      });
      bar.appendChild(b);
    }
    const cbb = el('span', 'shelf-fmt-b shelf-fmt-cbx');
    cbb.innerHTML = SVG.checkbox;
    cbb.title = 'Checklist (⌘⇧9)';
    a11y(cbb, 'Checklist (⌘⇧9)');
    cbb.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    cbb.addEventListener('click', (e) => {
      e.stopPropagation();
      // nbsp, not a plain space: trailing spaces collapse at line end, which
      // parks the caret flush against the box instead of where text starts
      insertChecklistBox(getEd && getEd());
    });
    bar.appendChild(cbb);
    if (onLink) bar.appendChild(el('span', 'shelf-fmt-sep'));
    if (onLink) {
      const lb = el('span', 'shelf-fmt-b shelf-fmt-linkbtn');
      lb.innerHTML = SVG.link;
      lb.title = 'Link selected text (⌘K)';
      a11y(lb, lb.title);
      lb.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      lb.addEventListener('click', (e) => { e.stopPropagation(); onLink(); });
      bar.appendChild(lb);
    }
    return bar;
  }

  // small "paste a link" row for the note editors: remembers the selection,
  // wraps it with execCommand('createLink') on Enter (sanitizer normalizes
  // the anchor at save), or inserts the bare URL when nothing was selected
  function makeLinkRow(getEd) {
    const row = el('div', 'shelf-linkrow');
    const input = el('input', 'shelf-input');
    input.type = 'text';
    input.placeholder = 'Link URL — Enter to apply, Esc to cancel';
    row.appendChild(input);
    row.style.display = 'none';
    let savedRange = null;

    function open() {
      const ed = getEd();
      const sel = getSelection();
      savedRange = sel.rangeCount && ed.contains(sel.anchorNode)
        ? sel.getRangeAt(0).cloneRange() : null;
      row.style.display = '';
      input.value = '';
      input.focus();
    }

    function close(apply) {
      row.style.display = 'none';
      const ed = getEd();
      let url = (input.value || '').trim();
      ed.focus();
      const sel = getSelection();
      if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
      if (apply && url) {
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        try {
          if (savedRange && !savedRange.collapsed) document.execCommand('createLink', false, url);
          else document.execCommand('insertText', false, url + ' ');
        } catch (e) {}
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      }
      savedRange = null;
    }

    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(false); }
    });
    return { row, open };
  }

  function makeSwatches(initial, onPick, allowNone, palette) {
    const row = el('span', 'shelf-sw-row');
    if (allowNone) {
      const none = el('span', 'shelf-sw shelf-sw-none');
      none.title = 'No color';
      a11y(none, 'No color');
      if (!initial) none.classList.add('shelf-sw-sel');
      none.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      none.addEventListener('click', (e) => {
        e.stopPropagation();
        row.querySelectorAll('.shelf-sw').forEach((x) => x.classList.toggle('shelf-sw-sel', x === none));
        onPick(null);
      });
      row.appendChild(none);
    }
    for (const c of (palette || NOTE_COLORS)) {
      const sw = el('span', 'shelf-sw shelf-sw-' + c);
      sw.title = c.charAt(0).toUpperCase() + c.slice(1);
      a11y(sw, sw.title);
      if (c === initial) sw.classList.add('shelf-sw-sel');
      sw.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        row.querySelectorAll('.shelf-sw').forEach((x) => x.classList.toggle('shelf-sw-sel', x === sw));
        onPick(c);
      });
      row.appendChild(sw);
    }
    return row;
  }

  function makeDeleteBtn(onDelete) {
    const x = el('span', 'shelf-del', '✕');
    x.title = 'Delete note';
    a11y(x, 'Delete note');
    x.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    x.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
    return x;
  }

  function focusEnd(node) {
    node.focus();
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  function openNotePopoverFor(tid, rect) {
    const pop = el('div', 'shelf-pop');
    const ed = el('div', 'shelf-pop-ed');
    ed.contentEditable = 'true';
    ed.setAttribute('data-ph', 'Next step, or what you’re waiting on…');
    const n0 = notes[tid];
    if (n0) renderNoteInto(ed, n0);
    pop.appendChild(ed);

    let timer = null;
    let color = (n0 && n0.c) || null;
    const save = () => {
      syncCheckboxAttrs(ed);
      return saveNote(tid, ed.textContent, color, sanitizeNoteHtml(ed.innerHTML)).then(scheduleRender);
    };

    let linkRow;
    const tools = el('div', 'shelf-pop-tools');
    tools.appendChild(makeFmtBar(() => linkRow.open(), () => ed));
    tools.appendChild(makeSwatches(color, (c) => {
      color = c;
      if (timer) { clearTimeout(timer); timer = null; }
      save();
    }, true));
    tools.appendChild(makeDeleteBtn(() => {
      if (timer) { clearTimeout(timer); timer = null; }
      const prev = notes[tid];
      ed.textContent = '';
      closeOverlay(); // the close callback saves the now-empty note, deleting it
      if (prev && prev.text) {
        showUndoToast('Note deleted', () => {
          notes[tid] = prev;
          sset({ ['note:' + tid]: prev });
          scheduleRender();
        });
      }
    }));
    pop.appendChild(tools);
    linkRow = makeLinkRow(() => ed);
    pop.appendChild(linkRow.row);
    pop.appendChild(el('div', 'shelf-pop-hint', 'Autosaves · ⌘⏎ or Esc to close'));

    const queueSave = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; save(); }, 500);
    };
    ed.addEventListener('input', queueSave);
    ed.addEventListener('change', queueSave); // checkbox toggles fire change, not input
    ed.addEventListener('mousedown', (e) => e.stopPropagation());
    ed.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') closeOverlay();
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        closeOverlay(); // the close callback saves
      } else if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        linkRow.open();
      } else if (fmtKey(e, ed)) {
        e.preventDefault();
      } else checklistEnter(e, ed);
    });

    openOverlay(pop, rect.left - 260, rect.bottom + 6, () => {
      if (timer) clearTimeout(timer);
      save();
    });
    setTimeout(() => focusEnd(ed), 0);
  }

  // ------------------------------------------------------- undo toast ----
  // Gmail's own idiom for destructive actions: a quiet snackbar with Undo.
  let toastEl = null;
  let toastTimer = null;

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) { toastEl.remove(); toastEl = null; }
  }

  function showInfoToast(text) {
    hideToast();
    toastEl = el('div', 'shelf-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.appendChild(el('span', null, text));
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(hideToast, 8000);
  }

  function showUndoToast(text, onUndo) {
    hideToast();
    toastEl = el('div', 'shelf-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.appendChild(el('span', null, text));
    const a = el('span', 'shelf-toast-a', 'Undo');
    a11y(a, 'Undo');
    a.addEventListener('mousedown', (e) => e.stopPropagation());
    a.addEventListener('click', (e) => {
      e.stopPropagation();
      hideToast();
      onUndo();
    });
    toastEl.appendChild(a);
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(hideToast, 7000);
  }

  // ------------------------------------------------ gmail-style tooltip ----
  // The small dark label Gmail shows under its own toolbar buttons.
  let gtipEl = null;
  let gtipTimer = null;

  function gtipHide() {
    if (gtipTimer) { clearTimeout(gtipTimer); gtipTimer = null; }
    if (gtipEl) { gtipEl.remove(); gtipEl = null; }
  }

  function attachGTip(node, text) {
    node.addEventListener('mouseenter', () => {
      gtipHide();
      gtipTimer = setTimeout(() => {
        gtipEl = el('div', 'shelf-gtip', typeof text === 'function' ? text() : text);
        document.body.appendChild(gtipEl);
        const r = node.getBoundingClientRect();
        const g = gtipEl.getBoundingClientRect();
        let left = r.left + r.width / 2 - g.width / 2;
        left = Math.max(4, Math.min(left, window.innerWidth - g.width - 4));
        // enough gap to clear the neighboring buttons' hover circles
        let top = r.bottom + 14;
        if (top + g.height > window.innerHeight - 4) top = r.top - g.height - 14;
        gtipEl.style.left = left + 'px';
        gtipEl.style.top = top + 'px';
      }, 300);
    });
    node.addEventListener('mouseleave', gtipHide);
    node.addEventListener('mousedown', gtipHide);
  }

  // ------------------------------------------------------- hover tooltip ----
  let tipEl = null;
  let tipTimer = null;

  function tipHide() {
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    if (tipEl) { tipEl.remove(); tipEl = null; }
  }

  function tipShow(note, rect) {
    tipHide();
    tipTimer = setTimeout(() => {
      tipEl = el('div', 'shelf-tip' + (note.c ? ' shelf-c-' + note.c : ''));
      renderNoteInto(tipEl, note);
      document.body.appendChild(tipEl);
      const r = tipEl.getBoundingClientRect();
      let top = rect.bottom + 6;
      if (top + r.height > window.innerHeight - 8) top = rect.top - r.height - 6;
      tipEl.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - r.width - 12)) + 'px';
      tipEl.style.top = Math.max(8, top) + 'px';
    }, 150);
  }

  // ------------------------------------------------- clicks stay Gmail's ----
  // v0.19.0 intercepted row clicks and hash-navigated by legacy thread id,
  // because the old renderer reordered Gmail's rows and broke its positional
  // click map. Both halves of that are gone: the pristine-tbody layout never
  // moves a row (so Gmail's click→thread mapping — the clicked <tr>'s index
  // among ALL tbody <tr>s — stays correct even when rows are only VISUALLY
  // transposed by transform), and Gmail's frontend stopped honoring legacy
  // hex ids in the hash, which had turned the interception itself into a
  // dead click. Native click handling is both correct and required now.

  // Vertical-split preview renders tall multi-line "card" rows; classic
  // rows are ~28-44px. Majority vote over the first few rows so one tall
  // outlier (inline attachment chips) can't flip the signal.
  function cardRows(tb) {
    const rows = tb.querySelectorAll('tr.zA');
    let tall = 0;
    let n = 0;
    for (let i = 0; i < rows.length && n < 5; i++) {
      n++;
      if (rows[i].offsetHeight > 60) tall++;
    }
    return n > 0 && tall >= Math.ceil(n * 0.6);
  }

  // Reading-pane (split) views: grouping pauses there (render's split guard).
  //
  // Ground truth measured in real Gmail (2026-07): the old [gh=tl].aia
  // marker is dead; a `.aia` container now exists whenever the reading-pane
  // FEATURE is enabled — including its "No split" mode — so it gates but
  // cannot decide. Geometry decides, with wide margins (measured: no-split
  // right-gap 72px vs vertical 527px; no-split scroller-bottom-gap 16px vs
  // horizontal ~495px). Any signal suffices; returns its name for the diag
  // ring so Copy Diagnostics shows exactly why a click was owned or passed.
  function readingPaneActive() {
    const tb = visibleThreadTable();
    if (!tb) return '';
    const h2 = Array.prototype.find.call(
      document.querySelectorAll('h2[data-legacy-thread-id]'),
      (n) => n.offsetParent);
    if (h2) return 'conv-beside-list';
    if (cardRows(tb)) return 'card-rows'; // vertical split's own row rendering
    const aia = document.querySelector('.aia');
    if (aia && aia.offsetParent) {
      const r = tb.getBoundingClientRect();
      if (window.innerWidth - r.right > 300) return 'v-split';
      const sp = scrollParentOf(tb);
      if (sp && sp !== document.documentElement && sp !== document.body &&
          sp !== document.scrollingElement) {
        const sr = sp.getBoundingClientRect();
        if (sr.height > 120 && window.innerHeight - sr.bottom > 200) return 'h-split';
      }
    }
    return '';
  }

  // ---------------------------------------------------- keyboard shortcuts ----
  // Alt-combos avoid every one of Gmail's single-key bindings. Alt+N = note,
  // Alt+M = move to section, Alt+↑/↓ = reorder. e.code is used so macOS
  // Option-char mapping is moot.
  //
  // WHICH thread does a shortcut act on? Two kinds of user mean two different
  // things. Someone driving with the mouse means the row under the pointer.
  // Someone driving with the keyboard means Gmail's cursor row — the one j/k
  // moved to, wearing the blue edge — and their pointer is wherever it was
  // last abandoned, very often parked over an unrelated thread. Reading hover
  // unconditionally moves the wrong thread for them.
  //
  // So track when each input was last *used* and let the more recent intent
  // win — the same judgement :focus-visible makes about painting a ring. A
  // pointer sitting still fires no events, so it goes stale on its own.
  let kbdHoverRow = null;
  let pointerAt = 0;
  let kbdNavAt = 0;

  document.addEventListener('mouseover', (e) => {
    const r = e.target && e.target.closest ? e.target.closest('tr.zA') : null;
    if (r) { kbdHoverRow = r; pointerAt = Date.now(); }
  }, true);

  // Gmail moves real DOM focus onto its cursor row (it must, for screen
  // readers), so focus landing on a row means the keyboard is driving.
  document.addEventListener('focusin', (e) => {
    const r = e.target && e.target.closest ? e.target.closest('tr.zA') : null;
    if (r) kbdNavAt = Date.now();
  }, true);

  // ...and Gmail's own list-navigation keys say so even if focus never moves.
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return; // our own combos don't count
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    if (e.code === 'KeyJ' || e.code === 'KeyK' ||
        e.code === 'ArrowUp' || e.code === 'ArrowDown') kbdNavAt = Date.now();
  }, true);

  const liveRow = (r) => (r && r.isConnected && r.offsetParent) ? r : null;

  // Gmail's cursor row. Measured against real Gmail: it keeps a roving
  // tabindex — the cursor row is tabindex="0", every other row -1 — and also
  // tags that row with a class. The tabindex is the signal to trust;
  // document.activeElement goes stale the instant focus leaves the page (a
  // devtools pane, another window), which would silently hand targeting back
  // to the pointer. The class is a hint only: Gmail's obfuscated names are no
  // kind of contract. Focus is the last resort.
  function cursorRow() {
    const tb = visibleThreadTable();
    if (tb) {
      const marked = tb.querySelector('tr.zA[tabindex="0"]') || tb.querySelector('tr.zA.btb');
      if (liveRow(marked)) return marked;
    }
    const ae = document.activeElement;
    return liveRow(ae && ae.closest ? ae.closest('tr.zA') : null);
  }

  // ------------------------------------------------- labs.cursor ----
  // Gmail's cursor walks its own internal list, which is date order — not the
  // order Shelf paints. So in a shelved label j/k appears to leap about.
  //
  // Shelf does NOT keep a rival cursor. A second cursor would drift from
  // Gmail's, and every Gmail key that acts on "the cursor row" (Enter, e, #,
  // r, l, v, b, !) would then fire against a thread you are not looking at —
  // silently, and destructively for half of them.
  //
  // Instead Shelf steers Gmail's REAL cursor. Gmail ignores synthetic keys,
  // but it does move its cursor when a row's checkbox is clicked, and two
  // clicks are net-zero on selection state whichever way the box started
  // (measured against real Gmail: cursor 3 → 9 → 5, no rows left selected, no
  // selection toolbar). So Shelf can place Gmail's own cursor precisely, and
  // because Gmail stays authoritative, every Gmail shortcut keeps pointing at
  // the row you can see. There is one cursor, and it is Gmail's.
  //
  // Fail toward Gmail, never toward guessing: the key is only swallowed once
  // the cursor has verifiably landed. If the sync stops working — Gmail
  // changes this behavior — Shelf surrenders the keys and gets out of the way.
  let cursorSyncFails = 0;
  let cursorSyncBroken = false;

  function rowByTid(tid) {
    if (!tid) return null;
    const tb = visibleThreadTable();
    if (!tb) return null;
    for (const r of tb.querySelectorAll('tr.zA')) {
      if (threadIdOf(r) === tid) return liveRow(r);
    }
    return null;
  }

  // Every visible thread, in the order it is PAINTED — the same walk render()
  // does: sections in their arranged order, each bucket in its rank order,
  // sub-shelves immediately after their parent, collapsed rows skipped.
  function visualThreadOrder() {
    const label = currentLabel();
    if (!label) return [];
    const cfg = labelCfg(label, false);
    if (!cfg.list.length) return bucketOrder(':else');
    const out = [];
    const pushSec = (s, parentCollapsed) => {
      const hidden = parentCollapsed || !!s.collapsed;
      if (!hidden) out.push.apply(out, bucketOrder(s.id));
      for (const k of childrenOf(cfg, s.id)) pushSec(k, hidden);
    };
    for (const id of combinedIds(cfg)) {
      if (id === ':else') {
        if (!cfg.elseCollapsed) out.push.apply(out, bucketOrder(':else'));
      } else {
        const s = cfg.list.find((x) => x.id === id);
        if (s) pushSec(s, false);
      }
    }
    return out;
  }

  // Put Gmail's own cursor on a row, by the one route Gmail honors: clicking
  // the row's checkbox. Two clicks restore whatever the box was, so a real
  // multi-selection is never disturbed. Returns true ONLY if the cursor
  // verifiably landed — the caller swallows the keypress on that basis alone.
  function syncGmailCursorTo(row) {
    const cb = row && row.querySelector('[role="checkbox"]');
    if (!cb) return false;
    const was = cb.getAttribute('aria-checked');
    cb.click();
    cb.click();
    if (cb.getAttribute('aria-checked') !== was) cb.click(); // never leave selection altered
    return row.getAttribute('tabindex') === '0' || row.classList.contains('btb');
  }

  // Move Gmail's cursor one step through the order Shelf paints.
  function cursorNavVisual(dir) {
    if (!labs.cursor || cursorSyncBroken) return false;
    if (shelfHidden) return false; // the screen IS Gmail's order; native nav is already right
    if (readingPaneActive() || multiplePanes()) return false;
    const label = currentLabel();
    if (!label) return false;
    const cfg = labelCfg(label, false);
    if (!cfg.list.length) return false; // no shelves: Gmail's order already IS the visual order
    const order = visualThreadOrder();
    if (order.length < 2) return false;
    const cur = cursorRow();
    const i = order.indexOf(cur ? threadIdOf(cur) : null);
    const next = i < 0 ? (dir > 0 ? 0 : order.length - 1) : i + dir;
    if (next < 0 || next >= order.length) return false; // at an end — let Gmail do as it likes
    const row = rowByTid(order[next]);
    if (!row) return false;
    if (row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    if (!syncGmailCursorTo(row)) {
      // three strikes and Shelf stops touching these keys for the session
      if (++cursorSyncFails >= 3) {
        cursorSyncBroken = true;
        recordDiag('cursor sync failed 3x — surrendering j/k to Gmail');
      }
      return false;
    }
    cursorSyncFails = 0;
    return true;
  }

  // The thread a shortcut acts on: whichever input the person just used.
  function shortcutRow() {
    const cur = cursorRow();
    const hov = liveRow(kbdHoverRow);
    return kbdNavAt > pointerAt ? (cur || hov) : (hov || cur);
  }

  // Alt+↑/↓ nudges a row one slot within its own section (a shelf or
  // "Everything else") — the keyboard twin of a reorder drag. It reuses
  // assignManyAt, so ranks and persistence match the drag path exactly, and it
  // reads the section's order from the same rank model the renderer paints by
  // (bucketOrder) — not from on-screen geometry — so a rapid second nudge sees
  // the first one's result even before its glide animation has settled.
  function reorderRow(row, dir) {
    if (readingPaneActive() || multiplePanes()) return false; // split view: reordering corrupts Gmail's click map
    if (shelfHidden) return false; // reordering an order you can't see lands as a surprise later
    const label = currentLabel();
    if (!label) return false;
    const cfg = labelCfg(label, false);
    const tid = threadIdOf(row);
    if (!tid) return false;
    const a = assignments[tid];
    const sec = a && cfg.list.some((s) => s.id === a.s) ? a.s : ':else';
    const sib = bucketOrder(sec);
    const i = sib.indexOf(tid);
    if (i < 0) return false;
    if (dir < 0) {
      if (i === 0) return false;                    // already at the top of its section
      assignManyAt([tid], sec, sib[i - 1]);         // hop above the row that was above it
    } else {
      if (i >= sib.length - 1) return false;         // already at the bottom
      assignManyAt([tid], sec, sib[i + 2] || null);  // hop below the row that was below it
    }
    return true;
  }

  // labs.cursor: j/k and ↑/↓ move Gmail's own cursor through the order Shelf
  // paints. The key is swallowed only once the cursor has verifiably landed —
  // otherwise Gmail handles it exactly as it always has.
  document.addEventListener('keydown', (e) => {
    if (!labs.cursor || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const down = e.code === 'KeyJ' || e.code === 'ArrowDown';
    const up = e.code === 'KeyK' || e.code === 'ArrowUp';
    if (!down && !up) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    if (cursorNavVisual(down ? 1 : -1)) {
      e.preventDefault();
      e.stopPropagation();
      tipHide();
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.code !== 'KeyN' && e.code !== 'KeyM' && e.code !== 'ArrowUp' &&
        e.code !== 'ArrowDown' && e.code !== 'KeyS') return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    // Alt+S flips the Hide toggle — same act as clicking the eye. Only where
    // Shelf is active at all (a label view); in search results there is
    // nothing to hide and a silent state flip would just be confusing.
    if (e.code === 'KeyS') {
      if (!currentLabel()) return;
      e.preventDefault();
      e.stopPropagation();
      tipHide();
      toggleShelfHidden();
      return;
    }
    // Alt+↑/↓ reorders a list row; it never acts on the open conversation
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const row = shortcutRow();
      if (!row) return;
      if (reorderRow(row, e.code === 'ArrowUp' ? -1 : 1)) {
        e.preventDefault();
        e.stopPropagation();
        tipHide();
      }
      return;
    }
    // open conversation: Alt+N edits its note in place
    const h2 = Array.prototype.find.call(
      document.querySelectorAll('h2[data-legacy-thread-id]'),
      (n) => n.offsetParent);
    if (h2) {
      const tid = h2.getAttribute('data-legacy-thread-id');
      if (e.code === 'KeyN' && tid) {
        e.preventDefault();
        e.stopPropagation();
        startStripEdit(ensureStrip(h2, tid), tid);
      }
      return;
    }
    const row = shortcutRow();
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    tipHide();
    if (e.code === 'KeyN') {
      const anchor = row.querySelector('.shelf-btn-note') || row;
      openNotePopover(row, anchor.getBoundingClientRect());
    } else {
      const anchor = row.querySelector('.shelf-btn-assign') || row;
      openAssignMenu(row, anchor.getBoundingClientRect());
    }
  }, true);

  // ---------------------------------------------------------------- drag ----
  // edge-autoscroll while any Shelf drag is in flight
  function scrollParentOf(node) {
    let p = node && node.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) return p;
      p = p.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  let autoScrollEl = null;
  let autoScrollV = 0;
  let autoScrollRAF = 0;

  function autoScrollTick() {
    if (autoScrollEl && autoScrollV) {
      autoScrollEl.scrollTop += autoScrollV;
      autoScrollRAF = requestAnimationFrame(autoScrollTick);
    } else {
      autoScrollRAF = 0;
    }
  }

  function autoScrollUpdate(scroller, y) {
    const MARGIN = 80;
    const MAX_STEP = 18;
    const h = window.innerHeight;
    let v = 0;
    if (y < MARGIN) v = -Math.ceil(((MARGIN - y) / MARGIN) * MAX_STEP);
    else if (y > h - MARGIN) v = Math.ceil(((y - (h - MARGIN)) / MARGIN) * MAX_STEP);
    autoScrollEl = scroller;
    autoScrollV = v;
    if (v && !autoScrollRAF) autoScrollRAF = requestAnimationFrame(autoScrollTick);
  }

  function autoScrollStop() {
    autoScrollV = 0;
    autoScrollEl = null;
    if (autoScrollRAF) {
      cancelAnimationFrame(autoScrollRAF);
      autoScrollRAF = 0;
    }
  }

  function suppressNextClick() {
    const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener('click', stop, true);
    setTimeout(() => document.removeEventListener('click', stop, true), 80);
  }

  function setDropHighlight(sectionId) {
    for (const tr of headerEls.values()) {
      tr.classList.toggle('shelf-drop', !!sectionId && tr.isConnected && tr.dataset.shelfSection === sectionId);
    }
  }

  function startAssignInteraction(e, row, btn) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;
    let target = null;
    let dragScroller = null;

    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        dragging = true;
        document.body.classList.add('shelf-dragging');
        document.body.classList.add('shelf-thread-drag');
        row.classList.add('shelf-drag-src');
        dragScroller = scrollParentOf(row);
        ghost = el('div', 'shelf-ghost', subjectOf(row));
        document.body.appendChild(ghost);
      }
      if (!dragging) return;
      ghost.style.left = (ev.clientX + 12) + 'px';
      ghost.style.top = (ev.clientY + 10) + 'px';
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const tr = under && under.closest ? under.closest('.shelf-header, tr.zA') : null;
      let nt = null;
      if (tr) {
        if (tr.classList.contains('shelf-header')) {
          nt = tr.dataset.shelfSection;
        } else {
          const otherId = threadIdOf(tr);
          const a = otherId && assignments[otherId];
          const cfg = labelCfg(currentLabel() || '', false);
          nt = a && cfg.list.some((s) => s.id === a.s) ? a.s : ':else';
        }
      }
      target = nt;
      setDropHighlight(nt);
      autoScrollUpdate(dragScroller, ev.clientY);
    };

    const up = () => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      if (dragging) {
        autoScrollStop();
        document.body.classList.remove('shelf-dragging');
        document.body.classList.remove('shelf-thread-drag');
        row.classList.remove('shelf-drag-src');
        if (ghost) ghost.remove();
        setDropHighlight(null);
        suppressNextClick();
        const tid = threadIdOf(row);
        if (tid && target) {
          if (target === ':else') unassignMany([tid]); else assignMany([tid], target);
        }
      } else {
        openAssignMenu(row, btn.getBoundingClientRect());
      }
      document.removeEventListener('keydown', onKeyCancel, true);
      window.removeEventListener('blur', onBlurCancel);
    };

    const onKeyCancel = (ev) => {
      if (ev.key === 'Escape' && dragging) { ev.stopPropagation(); target = null; up(); }
    };
    const onBlurCancel = () => { if (dragging) { target = null; up(); } };

    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', up, true);
    document.addEventListener('keydown', onKeyCancel, true);
    window.addEventListener('blur', onBlurCancel);
  }

  // ----------------------------------------------------------- selection ----
  // Gmail's select checkbox is the first [role="checkbox"] in the row
  // (the star is also a checkbox, but always comes after it).
  function isRowSelected(row) {
    const c = row.querySelector('[role="checkbox"]');
    return !!c && c.getAttribute('aria-checked') === 'true';
  }

  function selectedTids(table) {
    if (!table) return [];
    const out = [];
    for (const row of table.querySelectorAll('tr.zA')) {
      if (!isRowSelected(row)) continue;
      const tid = threadIdOf(row);
      if (tid) out.push(tid);
    }
    return out;
  }

  // ------------------------------------------------------------- row drag ----
  // Passive augmentation of Gmail's own row drag: we never preventDefault,
  // so drag-to-sidebar-label keeps working. We only watch the pointer and,
  // when it's released over one of our section headers, do the assignment.
  function rowDragInit() {
    let start = null; // { x, y, row }
    let active = false;
    let target = null;
    let posTarget = null; // { sectionId, beforeTid } — precise within-section drop
    let dimmed = null; // the rows being carried, dimmed while dragging
    let scroller = null;

    function interactive(t) {
      return !!(t && t.closest &&
        t.closest('[role="checkbox"], ul[role="toolbar"], a, button, input, ' +
          '.shelf-li, .shelf-chip, .shelf-menu, .shelf-pop, .shelf-hint, .shelf-multibar'));
    }

    function headerUnder(x, y) {
      // elementsFromPoint sees through Gmail's drag ghost to our header rows
      for (const n of document.elementsFromPoint(x, y)) {
        const tr = n.closest ? n.closest('.shelf-header') : null;
        if (tr) return tr;
      }
      return null;
    }

    function rowUnder(x, y) {
      for (const n of document.elementsFromPoint(x, y)) {
        const tr = n.closest ? n.closest('tr.zA') : null;
        if (tr) return tr;
      }
      return null;
    }

    function move(ev) {
      if (!start) return;
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= 6) return;
        active = true;
        document.body.classList.add('shelf-row-drag');
        dimmed = [start.row];
        if (isRowSelected(start.row)) {
          const tb = visibleThreadTable();
          const sel = tb ? Array.prototype.filter.call(tb.querySelectorAll('tr.zA'), isRowSelected) : [];
          if (sel.length) dimmed = sel; // the whole selection is being carried
        }
        dimmed.forEach((r) => r.classList.add('shelf-drag-src'));
        scroller = scrollParentOf(visibleThreadTable());
      }
      const tr = headerUnder(ev.clientX, ev.clientY);
      target = tr ? tr.dataset.shelfSection : null;
      posTarget = null;
      if (!tr) {
        // over a thread row: offer precise placement within its bucket —
        // a real section, or "Everything else" (secOf maps unfiled rows to
        // ':else', so leftover rows reorder exactly like a section's do)
        const hov = rowUnder(ev.clientX, ev.clientY);
        if (hov && dimmed && dimmed.indexOf(hov) === -1) {
          const cfgNow = labelCfg(currentLabel() || '', false);
          const secOf = (id) => {
            const a = id && assignments[id];
            return a && cfgNow.list.some((s) => s.id === a.s) ? a.s : ':else';
          };
          const hid = threadIdOf(hov);
          const sec = secOf(hid);
          const r = hov.getBoundingClientRect();
          const upper = ev.clientY < r.top + r.height / 2;
          let beforeTid = hid;
          if (!upper) {
            const next = hov.nextElementSibling;
            const nid = next && next.classList && next.classList.contains('zA') ? threadIdOf(next) : null;
            beforeTid = nid && secOf(nid) === sec ? nid : null;
          }
          posTarget = { sectionId: sec, beforeTid };
          showInsLine({ top: (upper ? r.top : r.bottom) - 1, left: r.left, width: r.width });
        }
      }
      if (!posTarget) hideInsLine();
      setDropHighlight(target);
      autoScrollUpdate(scroller, ev.clientY);
    }

    function up() {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      const row = start && start.row;
      const tgt = target;
      const pt = posTarget;
      const wasActive = active;
      start = null; active = false; target = null; posTarget = null;
      if (!wasActive) return;
      autoScrollStop();
      hideInsLine();
      document.body.classList.remove('shelf-row-drag');
      if (dimmed) {
        dimmed.forEach((r) => r.classList.remove('shelf-drag-src'));
        dimmed = null;
      }
      setDropHighlight(null);
      log('rowdrag: up', !!row, tgt, pt);
      if (!row || (!tgt && !pt)) return; // dropped elsewhere — Gmail's own drag handles it
      suppressNextClick();
      let tids = [threadIdOf(row)].filter(Boolean);
      if (tids.length && isRowSelected(row)) {
        const sel = selectedTids(visibleThreadTable());
        if (sel.indexOf(tids[0]) >= 0) tids = sel; // dragging a selected row moves the whole selection
      }
      if (!tids.length) return;
      if (pt) assignManyAt(tids, pt.sectionId, pt.beforeTid);
      else if (tgt === ':else') unassignMany(tids);
      else assignMany(tids, tgt);
      log('row drop', tids.length, '→', pt ? pt.sectionId + ' @ ' + pt.beforeTid : tgt);
    }

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || start) { log('rowdrag reject: button/stuck', e.button, !!start); return; }
      const label = currentLabel();
      if (!label || !labelCfg(label, false).list.length) { log('rowdrag reject: no sections for', label); return; } // no headers to drop on
      const row = e.target && e.target.closest ? e.target.closest('tr.zA') : null;
      if (!row || interactive(e.target)) { log('rowdrag reject: row/interactive', !!row); return; }
      log('rowdrag: armed');
      start = { x: e.clientX, y: e.clientY, row };
      document.addEventListener('mousemove', move, true);
      document.addEventListener('mouseup', up, true);
    }, true);

    // Esc cancels an in-flight drag; losing window focus (released the mouse
    // outside the browser) aborts too, so the drag never comes back "stuck"
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (start || active)) {
        e.stopPropagation();
        target = null;
        posTarget = null;
        up();
      }
    }, true);
    window.addEventListener('blur', () => {
      if (start || active) { target = null; posTarget = null; up(); }
    });
  }

  // ------------------------------------------------------ multi-select bar ----
  let multibar = null;
  let multibarTids = [];

  function updateMultiBar(label, table) {
    const tids = label ? selectedTids(table) : [];
    multibarTids = tids;
    if (!tids.length) {
      if (multibar) { multibar.remove(); multibar = null; }
      return;
    }
    if (!multibar) {
      multibar = el('div', 'shelf-multibar');
      multibar.appendChild(el('span', 'shelf-multibar-t'));
      const btn = el('span', 'shelf-multibar-btn');
      btn.innerHTML = SVG.shelf + '<span>Move to section</span>';
      a11y(btn, 'Move selected conversations to section');
      btn.addEventListener('mousedown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAssignMenuFor(multibarTids.slice(), btn.getBoundingClientRect(), true);
      });
      multibar.appendChild(btn);
      document.body.appendChild(multibar);
    }
    // only touch the DOM on change — our MutationObserver watches the body
    const t = multibar.querySelector('.shelf-multibar-t');
    const txt = tids.length + ' selected';
    if (t && t.textContent !== txt) t.textContent = txt;
  }

  // ------------------------------------------------------- first-run hint ----
  // Priority Inbox / Multiple Inboxes render several thread tables in one
  // view — the same positional-click hazard as split view
  function multiplePanes() {
    const ts = document.querySelectorAll('table.F');
    let vis = 0;
    for (const t2 of ts) { if (t2.offsetParent) vis++; if (vis > 1) return true; }
    return false;
  }

  // one quiet heads-up per session when sections exist but the current
  // layout has them paused
  let splitNoticeShown = false;

  function splitNotice(cfg) {
    if (splitNoticeShown || !cfg.list.length) return;
    splitNoticeShown = true;
    showInfoToast('Shelf sections pause in this Gmail layout — notes and filing still work.');
  }

  let hintDone = false;
  let hintEl = null;
  // One-time review ask — earned, not begged: only after retained, repeated
  // use. All three must hold: a month since install, 30+ threads filed, and
  // filing activity on 8+ distinct days (a binge test day doesn't qualify).
  // A month, not a week, on purpose: at a week Shelf is still a new toy you
  // are evaluating. The ask should land after you've stopped noticing it and
  // would miss it if it were gone — that's the review worth having. 8 days
  // rather than 4 for the same reason: 4 days spread across a month is a
  // dabbler, not a habit.
  const REVIEW_MIN_FILES = 30;
  const REVIEW_MIN_ACTIVE_DAYS = 8;
  const REVIEW_MIN_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  // Literal store id rather than chrome.runtime.id. manifest.json's "key" now
  // pins runtime.id to this same value, so the two agree — but this link is
  // what users see, and it once shipped pointing at "This item is not
  // available" because an unpacked build derives its id from the folder path.
  // Don't make the store link depend on how the extension was packaged.
  // Same URL lives in popup.js — update both if the listing ever moves.
  const STORE_REVIEW_URL =
    'https://chromewebstore.google.com/detail/dgomdjjoogkknnggfbggcdnlogkhdpng/reviews';
  let fileCount = 0;
  let fileDays = [];
  let firstUse = 0;
  let reviewDone = false;
  let reviewEl = null;
  // Second-stage, once-ever donation nudge: only after the review ask has
  // been resolved and the user is deeply retained. Dormant until the Ko-fi
  // URL below is configured (no dead links if launched before setup).
  // Kept a clear stretch behind the review ask — at 21 days it now sat inside
  // the review's own 30-day window, so the staging was gone.
  const DONATE_URL = 'https://ko-fi.com/getshelf';
  const DONATE_MIN_FILES = 100;
  const DONATE_MIN_ACTIVE_DAYS = 10;
  const DONATE_MIN_AGE_MS = 60 * 24 * 60 * 60 * 1000;
  let donateDone = false;
  let donateEl = null;

  function removeHint() {
    if (hintEl && hintEl.isConnected) hintEl.remove();
  }

  function markHintDone() {
    removeHint();
    if (hintDone) return;
    hintDone = true;
    sset({ hintDone: true });
  }

  function updateHint(label, cfg) {
    if (!label || hintDone || cfg.list.length) { removeHint(); return null; }
    if (!hintEl) {
      hintEl = el('div', 'shelf-hint');
      hintEl.innerHTML =
        '<div class="shelf-hint-b shelf-welcome">' + SVG.shelf +
        '<span>Welcome to Shelf! Click <span class="shelf-hint-ic">' + SVG.shelfPlus +
        '</span> in the toolbar to add your first section. Then hover any thread — ' +
        '☰ files it, ✎ sticks a private note on it.</span>' +
        '<span class="shelf-hint-x" title="Dismiss">✕</span></div>';
      const x = hintEl.querySelector('.shelf-hint-x');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); markHintDone(); scheduleRender(); });
    }
    return hintEl;
  }

  // ----------------------------------------------------------- review ask ----
  function removeReview() {
    if (reviewEl && reviewEl.isConnected) reviewEl.remove();
  }

  function markReviewDone() {
    removeReview();
    if (reviewDone) return;
    reviewDone = true;
    sset({ reviewDone: true });
  }

  function updateReviewAsk(label, hintShowing) {
    const engaged = fileCount >= REVIEW_MIN_FILES &&
      fileDays.length >= REVIEW_MIN_ACTIVE_DAYS &&
      firstUse > 0 && (Date.now() - firstUse) >= REVIEW_MIN_AGE_MS;
    const show = !!label && !reviewDone && engaged && !hintShowing && !canaryShown;
    if (!show) { removeReview(); return null; }
    if (!reviewEl) {
      reviewEl = el('div', 'shelf-hint');
      reviewEl.innerHTML =
        '<div class="shelf-hint-b shelf-review">' + SVG.shelf +
        '<span>Enjoying Shelf? A quick review genuinely helps.</span>' +
        '<a class="shelf-review-a" target="_blank" rel="noopener">Write a review</a>' +
        '<span class="shelf-hint-x" title="No thanks">✕</span></div>';
      const a = reviewEl.querySelector('.shelf-review-a');
      a.href = STORE_REVIEW_URL;
      a.addEventListener('mousedown', (e) => e.stopPropagation());
      a.addEventListener('click', (e) => { e.stopPropagation(); markReviewDone(); scheduleRender(); });
      const x = reviewEl.querySelector('.shelf-hint-x');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); markReviewDone(); scheduleRender(); });
    }
    return reviewEl;
  }

  // ---------------------------------------------------------- donate ask ----
  function removeDonate() {
    if (donateEl && donateEl.isConnected) donateEl.remove();
  }

  function markDonateDone() {
    removeDonate();
    if (donateDone) return;
    donateDone = true;
    sset({ donateDone: true });
  }

  function updateDonateAsk(label, priorShowing) {
    const configured = DONATE_URL.indexOf('YOUR_PAGE_HERE') === -1;
    const engaged = fileCount >= DONATE_MIN_FILES &&
      fileDays.length >= DONATE_MIN_ACTIVE_DAYS &&
      firstUse > 0 && (Date.now() - firstUse) >= DONATE_MIN_AGE_MS;
    const show = configured && !!label && !donateDone && reviewDone && engaged &&
      !priorShowing && !canaryShown;
    if (!show) { removeDonate(); return null; }
    if (!donateEl) {
      donateEl = el('div', 'shelf-hint');
      donateEl.innerHTML =
        '<div class="shelf-hint-b shelf-review">' + SVG.shelf +
        '<span>Shelf is free forever — I&rsquo;ll never charge you. If it has earned its keep, donate what it&rsquo;s worth to you:</span>' +
        '<a class="shelf-review-a" target="_blank" rel="noopener">☕ Support Shelf</a>' +
        '<span class="shelf-hint-x" title="No thanks">✕</span></div>';
      const a = donateEl.querySelector('.shelf-review-a');
      a.href = DONATE_URL;
      a.addEventListener('mousedown', (e) => e.stopPropagation());
      a.addEventListener('click', (e) => { e.stopPropagation(); markDonateDone(); scheduleRender(); });
      const x = donateEl.querySelector('.shelf-hint-x');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); markDonateDone(); scheduleRender(); });
    }
    return donateEl;
  }

  // ------------------------------------------------------ add-section row ----
  let addEl = null;

  function removeAdd() {
    if (addEl && addEl.isConnected) addEl.remove();
  }

  function updateAddRow(label) {
    if (!label) { removeAdd(); return null; }
    if (!addEl) {
      addEl = el('div', 'shelf-add');
      addEl.innerHTML = '<div class="shelf-add-b">' + SVG.shelfPlus + '<span>New section</span></div>';
      const b = addEl.querySelector('.shelf-add-b');
      b.addEventListener('mousedown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const lbl = currentLabel();
        if (!lbl) return;
        const menu = el('div', 'shelf-menu');
        inlineInput(menu, 'Section name', '', async (v) => {
          await createSection(lbl, v);
          scheduleRender();
        });
        appendKits(menu, lbl);
        const r = b.getBoundingClientRect();
        openOverlay(menu, r.left, r.bottom + 6);
      });
    }
    return addEl;
  }

  // Preferred placement: a small "+" in the list toolbar, after the ⋮ button.
  // Falls back to the bottom-of-list row when the toolbar can't be found
  // (e.g. non-English Gmail, or a Gmail redesign).
  let addBtnEl = null;

  // Every mark Shelf makes on Gmail's DOM, removed — the page as it looks with
  // the extension uninstalled. Idempotent, and the honest half of the Hide
  // toggle: if this leaves anything behind, the promise it demonstrates is a
  // lie. Nothing here touches stored data; turning Shelf back on restores it.
  function teardownAll() {
    cleanupHeaders();          // headers, row transforms, shelf-hidden, table margin
    removeHint();
    removeReview();
    removeDonate();
    removeAdd();
    updateMultiBar(null, null);
    tipHide();
    if (addBtnEl && addBtnEl.isConnected) addBtnEl.remove();
    const drawn = '.shelf-chip, .shelf-age, .shelf-rc-tick, .shelf-li, ' +
                  '.shelf-note-strip, .shelf-convbtn, .shelf-canary';
    for (const n of document.querySelectorAll(drawn)) n.remove();
    for (const r of document.querySelectorAll('tr.zA')) {
      r.classList.remove('shelf-cardrow', 'shelf-rc-red', 'shelf-rc-green',
        'shelf-rc-blue', 'shelf-rc-gray', 'shelf-rc-yellow');
      delete r.dataset.shelfTid;
    }
    for (const td of document.querySelectorAll('td.shelf-rc-cell')) td.classList.remove('shelf-rc-cell');
    for (const h of document.querySelectorAll('.shelf-ovhost')) h.classList.remove('shelf-ovhost');
    document.body.classList.remove('shelf-dragging', 'shelf-thread-drag', 'shelf-row-drag');
  }

  function toggleShelfHidden() {
    shelfHidden = !shelfHidden;
    shelfHiddenT = Date.now();
    sset({ shelfHidden: { v: shelfHidden, t: shelfHiddenT } });
    if (shelfHidden) teardownAll();
    else animateNextRender = true; // glide back: your order was never lost
    paintHideBtn();
    scheduleRender();
  }

  // The Hide toggle, beside the "+" in Gmail's own list toolbar. When Shelf is
  // hidden the "+" goes away too (nothing to add sections to), so the toolbar
  // gets simpler rather than busier.
  let hideBtnEl = null;
  let toreDown = false; // hidden renders after the first must not touch the DOM

  // Only ever touches attributes. a11y() and attachGTip() ADD listeners on
  // every call, so they are attached once at creation — the tooltip takes the
  // function form so its text can still change with state.
  function paintHideBtn() {
    if (!hideBtnEl) return;
    const want = shelfHidden ? 'off' : 'on';
    if (hideBtnEl.dataset.shelfState === want) return; // idempotent — see loop note above
    hideBtnEl.dataset.shelfState = want;
    hideBtnEl.innerHTML = shelfHidden ? SVG.shelfEyeOff : SVG.shelfEye; // bars + corner eye; struck eye = off
    hideBtnEl.classList.toggle('shelf-hidebtn-off', shelfHidden);
    hideBtnEl.setAttribute('aria-label',
      shelfHidden ? 'Show Shelf' : 'Hide Shelf — show Gmail’s original order');
  }

  function updateHideButton(label, anchor) {
    if (!label || !anchor) {
      if (hideBtnEl && hideBtnEl.isConnected) hideBtnEl.remove();
      return;
    }
    if (!hideBtnEl) {
      hideBtnEl = el('div', 'shelf-addbtn shelf-hidebtn');
      a11y(hideBtnEl, 'Hide Shelf');
      attachGTip(hideBtnEl, () => (shelfHidden ? 'Show Shelf · Alt+S' : 'Hide Shelf · Alt+S'));
      hideBtnEl.addEventListener('mousedown', (e) => e.stopPropagation());
      hideBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleShelfHidden();
      });
    }
    paintHideBtn();
    const cs = getComputedStyle(anchor);
    hideBtnEl.style.width = cs.width;
    hideBtnEl.style.height = cs.height;
    hideBtnEl.style.margin = cs.margin;
    hideBtnEl.style.padding = cs.padding;
    hideBtnEl.style.boxSizing = cs.boxSizing;
    // sit after the "+" when it's there, otherwise take its place
    const after = (addBtnEl && addBtnEl.isConnected && !shelfHidden) ? addBtnEl : anchor;
    if (after.nextElementSibling !== hideBtnEl) {
      after.parentElement.insertBefore(hideBtnEl, after.nextSibling);
    }
  }

  function toolbarAnchor(label) {
    if (!label) return null;
    const refresh = Array.prototype.find.call(
      document.querySelectorAll('[aria-label^="Refresh" i], [data-tooltip^="Refresh" i]'),
      (n) => n.offsetParent);
    if (!refresh) return null;
    const ct = refresh.closest('[gh="tm"]') ||
      (refresh.parentElement && refresh.parentElement.parentElement);
    if (!ct) return null;
    const more = Array.prototype.find.call(ct.querySelectorAll(MORE_SEL), (n) => n.offsetParent);
    return more || refresh;
  }

  function updateAddButton(label) {
    let anchor = null;
    if (label) {
      const refresh = Array.prototype.find.call(
        document.querySelectorAll('[aria-label^="Refresh" i], [data-tooltip^="Refresh" i]'),
        (n) => n.offsetParent);
      if (refresh) {
        const ct = refresh.closest('[gh="tm"]') ||
          (refresh.parentElement && refresh.parentElement.parentElement);
        if (ct) {
          // MORE_SEL: "More" / "More email options", aria-label or tooltip
          const more = Array.prototype.find.call(
            ct.querySelectorAll(MORE_SEL),
            (n) => n.offsetParent);
          anchor = more || refresh;
        }
      }
    }
    if (!anchor) {
      if (addBtnEl && addBtnEl.isConnected) addBtnEl.remove();
      return false;
    }
    if (!addBtnEl) {
      addBtnEl = el('div', 'shelf-addbtn');
      addBtnEl.innerHTML = SVG.shelfPlus;
      a11y(addBtnEl, 'New section (Shelf)');
      attachGTip(addBtnEl, 'New section');
      addBtnEl.addEventListener('mousedown', (e) => e.stopPropagation());
      addBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const lbl = currentLabel();
        if (!lbl) return;
        const menu = el('div', 'shelf-menu');
        inlineInput(menu, 'Section name', '', async (v) => {
          await createSection(lbl, v);
          scheduleRender();
        });
        appendKits(menu, lbl);
        const r = addBtnEl.getBoundingClientRect();
        openOverlay(menu, r.left - 60, r.bottom + 6);
      });
    }
    if (addBtnEl.previousElementSibling !== anchor) {
      // mirror the anchor button's box so we sit exactly on Gmail's grid
      const cs = getComputedStyle(anchor);
      addBtnEl.style.width = cs.width;
      addBtnEl.style.height = cs.height;
      addBtnEl.style.margin = cs.margin;
      addBtnEl.style.padding = cs.padding;
      addBtnEl.style.boxSizing = cs.boxSizing;
      addBtnEl.style.verticalAlign = cs.verticalAlign;
      anchor.insertAdjacentElement('afterend', addBtnEl);
    }
    return true;
  }

  // -------------------------------------------------- conversation note ----
  // A note icon in the conversation toolbar (always, tinted when a note
  // exists) + a sticky-note strip under the subject (only when one exists).
  let convBtn = null;

  // Gmail reveals an already-built conversation container by flipping its
  // display/class, and MO_OPTS filters attributes down to aria-checked — so
  // that reveal is invisible to our observer. The one render that follows
  // navigation could therefore land while the toolbar still had no layout
  // (⋮ offsetParent null, no anchor), and with nothing mutating afterwards
  // the button was never retried: it appeared only on the next incidental
  // DOM change (a hover) or the 4s safety net. Watching class/style on the
  // body subtree instead would be a firehose in Gmail, so catch up with a
  // bounded poll — armed on navigation, at init, and by updateConvNote
  // itself whenever a conversation is open with its toolbar not yet placed.
  let convCatchUpT = 0;
  let convArmedTid = null;
  function convCatchUp() {
    clearInterval(convCatchUpT);
    let tries = 0;
    convCatchUpT = setInterval(() => {
      updateConvNote();
      // done only when the button is actually laid out beside the ⋮ anchor
      if ((convBtn && convBtn.isConnected && convBtn.offsetParent) || ++tries > 66) {
        clearInterval(convCatchUpT);
        convCatchUpT = 0;
      }
    }, 120); // ~8s: a heavy conversation (AI Overview, avatars, images) is
             // routinely slower than a second to lay its toolbar out
  }

  // Gmail's overflow button is labelled "More" on consumer Gmail but "More
  // email options" on Workspace — and its data-tooltip is only set on hover,
  // while aria-label is present at rest. So match either attribute by a
  // case-insensitive "More" PREFIX, which lets aria-label anchor us the
  // instant the toolbar exists, no hover required. (Greg's Workspace inbox
  // exposed this: the exact-"More" selector matched nothing, so the button
  // surfaced only during the brief moment a hover populated the tooltip.)
  const MORE_SEL = '[aria-label^="More" i], [data-tooltip^="More" i]';

  // The conversation toolbar is the row directly above the subject, so anchor
  // to the "More" control sitting closest just above it. The per-message
  // overflow menu is below the subject (negative gap → rejected) and the
  // sidebar / list-toolbar controls are far off, so this lands on the
  // conversation's own ⋮ without an ancestor walk that could snag the wrong
  // menu.
  function findConvMore(h2) {
    const top = h2.getBoundingClientRect().top;
    let best = null;
    let gap = 200; // a control further than this above the subject isn't ours
    for (const c of document.querySelectorAll(MORE_SEL)) {
      if (!c.offsetParent) continue;
      const d = top - c.getBoundingClientRect().bottom;
      if (d >= -8 && d < gap) { gap = d; best = c; }
    }
    return best;
  }

  function updateConvNote() {
    if (document.querySelector('.shelf-note-strip.shelf-editing')) return; // don't disturb an active edit
    const h2 = Array.prototype.find.call(
      document.querySelectorAll('h2[data-legacy-thread-id]'),
      (n) => n.offsetParent);
    if (!h2) {
      if (convBtn && convBtn.isConnected) convBtn.remove();
      return;
    }
    const tid = h2.getAttribute('data-legacy-thread-id');
    if (!tid) return;
    const note = notes[tid];
    const has = !!(note && note.text);

    // toolbar button, aligned by mirroring the ⋮ button's box. findConvMore
    // anchors to the conversation's own overflow ⋮ (the one just above the
    // subject) — see its definition for why that beats a document-wide scan.
    const more = findConvMore(h2);
    if (more) {
      if (!convBtn) {
        convBtn = el('div', 'shelf-convbtn');
        convBtn.innerHTML = SVG.note;
        a11y(convBtn, 'Note (Shelf), Alt+N');
        attachGTip(convBtn, 'Note (Shelf) · Alt+N');
        convBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        convBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = convBtn.dataset.tid;
          const head = Array.prototype.find.call(
            document.querySelectorAll('h2[data-legacy-thread-id]'),
            (n) => n.offsetParent);
          if (!id || !head) return;
          startStripEdit(ensureStrip(head, id), id);
        });
      }
      if (convBtn.dataset.tid !== tid) convBtn.dataset.tid = tid;
      const bcls = 'shelf-convbtn' + (has ? ' shelf-has' + (note.c ? ' shelf-c-' + note.c : '') : '');
      if (convBtn.className !== bcls) convBtn.className = bcls;
      if (convBtn.previousElementSibling !== more) {
        const cs = getComputedStyle(more);
        convBtn.style.width = cs.width;
        convBtn.style.height = cs.height;
        convBtn.style.margin = cs.margin;
        convBtn.style.padding = cs.padding;
        convBtn.style.boxSizing = cs.boxSizing;
        convBtn.style.verticalAlign = cs.verticalAlign;
        more.insertAdjacentElement('afterend', convBtn);
      }
      convArmedTid = null; // placed — a later stall may arm the poll again
    } else if (convArmedTid !== tid) {
      // The conversation is open but its toolbar still has no layout. Gmail
      // does not always hand us a hashchange for a view swap, so arm the
      // catch-up from here as well — once per thread, so a Gmail whose ⋮ we
      // can never match (localized tooltip) can't poll forever.
      convArmedTid = tid;
      convCatchUp();
    }

    // note strip on its own line under the subject
    let strip = h2.parentElement && h2.parentElement.querySelector('.shelf-note-strip');
    if (!has) {
      if (strip) strip.remove();
      return;
    }
    strip = ensureStrip(h2, tid);
    const scls = 'shelf-note-strip' + (note.c ? ' shelf-c-' + note.c : '');
    if (strip.className !== scls) strip.className = scls;
    const t = strip.querySelector('.shelf-note-strip-t');
    renderNoteInto(t, note);
    // fold affordance only when the note is actually tall (or already folded)
    strip.classList.toggle('shelf-folded', !!note.fold);
    strip.classList.toggle('shelf-foldable', !!note.fold || t.scrollHeight > 52);
  }

  function ensureStrip(h2, tid) {
    let strip = h2.parentElement && h2.parentElement.querySelector('.shelf-note-strip');
    if (!strip) {
      strip = el('div', 'shelf-note-strip');
      // a DIV, not a span: Chrome's editing engine refuses to create block
      // lists (⌘⇧8/7) inside an inline-tag editing host, whatever its CSS
      strip.innerHTML = SVG.note + '<div class="shelf-note-strip-t"></div>';
      const fb = el('span', 'shelf-note-fold');
      fb.innerHTML = SVG.chevron;
      a11y(fb, 'Collapse note');
      attachGTip(fb, () => strip.classList.contains('shelf-folded') ? 'Expand note' : 'Collapse note');
      fb.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      fb.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = strip.dataset.tid;
        const note = id && notes[id];
        if (!note) return;
        const folded = !strip.classList.contains('shelf-folded');
        strip.classList.toggle('shelf-folded', folded);
        if (folded) note.fold = 1; else delete note.fold;
        a11y(fb, folded ? 'Expand note' : 'Collapse note');
        sset({ ['note:' + id]: note });
      });
      strip.appendChild(fb);
      strip.addEventListener('mousedown', (e) => e.stopPropagation());
      strip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target && e.target.closest && e.target.closest('a, input')) return; // follow links, toggle checkboxes
        if (strip.dataset.tid) startStripEdit(strip, strip.dataset.tid);
      });
      h2.insertAdjacentElement('afterend', strip);
    }
    if (strip.dataset.tid !== tid) strip.dataset.tid = tid;
    return strip;
  }

  // Checkboxes in a rendered (non-editing) strip toggle in place and save
  // immediately — no need to enter edit mode to tick something off.
  document.addEventListener('change', (e) => {
    const cb = e.target;
    if (!cb || cb.type !== 'checkbox' || !cb.closest) return;
    const stripT = cb.closest('.shelf-note-strip-t');
    if (!stripT) return;
    const strip = stripT.closest('.shelf-note-strip');
    if (!strip || strip.classList.contains('shelf-editing')) return;
    const tid = strip.dataset.tid;
    if (!tid) return;
    syncCheckboxAttrs(stripT);
    const note = notes[tid];
    saveNote(tid, stripT.textContent.trim(), (note && note.c) || null, sanitizeNoteHtml(stripT.innerHTML));
  }, true);

  // In-place editing: the strip's text becomes contenteditable, with a small
  // formatting/color/delete toolbar; committing happens on Esc or focus loss.
  function startStripEdit(strip, tid) {
    if (strip.classList.contains('shelf-editing')) return;
    tipHide();
    closeOverlay();
    const t = strip.querySelector('.shelf-note-strip-t');
    let color = (notes[tid] && notes[tid].c) || null;
    strip.className = 'shelf-note-strip shelf-editing' + (color ? ' shelf-c-' + color : '');
    t.contentEditable = 'true';

    let linkRow;
    const tools = el('div', 'shelf-note-tools');
    tools.appendChild(makeFmtBar(() => linkRow.open(), () => t));
    tools.appendChild(makeSwatches(color, (c) => {
      color = c;
      strip.className = 'shelf-note-strip shelf-editing' + (c ? ' shelf-c-' + c : '');
    }, true));
    tools.appendChild(el('span', 'shelf-pop-hint', 'Autosaves · ⌘⏎ or Esc to close'));
    tools.appendChild(makeDeleteBtn(() => {
      const prev = notes[tid];
      t.textContent = '';
      finish();
      if (prev && prev.text) {
        showUndoToast('Note deleted', () => {
          notes[tid] = prev;
          sset({ ['note:' + tid]: prev });
          scheduleRender();
        });
      }
    }));
    strip.appendChild(tools);
    linkRow = makeLinkRow(() => t);
    strip.appendChild(linkRow.row);

    let finished = false;
    function onKey(e) {
      e.stopPropagation(); // keep Gmail's single-key shortcuts out of the note
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(); }
      else if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); linkRow.open(); }
      else if (fmtKey(e, t)) { e.preventDefault(); }
      else checklistEnter(e, t);
    }
    function onStop(e) { e.stopPropagation(); }
    function onFocusOut(e) {
      if (!strip.contains(e.relatedTarget)) finish();
    }
    function finish() {
      if (finished) return;
      finished = true;
      t.removeEventListener('keydown', onKey);
      t.removeEventListener('keypress', onStop);
      t.removeEventListener('keyup', onStop);
      strip.removeEventListener('focusout', onFocusOut);
      const txt = t.textContent.trim();
      syncCheckboxAttrs(t);
      const h = sanitizeNoteHtml(t.innerHTML);
      t.contentEditable = 'false';
      tools.remove();
      linkRow.row.remove();
      strip.classList.remove('shelf-editing');
      if (!txt) strip.remove();
      saveNote(tid, txt, color, h).then(scheduleRender);
    }
    t.addEventListener('keydown', onKey);
    t.addEventListener('keypress', onStop);
    t.addEventListener('keyup', onStop);
    strip.addEventListener('focusout', onFocusOut);
    focusEnd(t);
  }

  // ------------------------------------------------------------ adorn row ----
  // Mirror the box metrics of Gmail's own hover-toolbar items so our buttons
  // align with archive/delete/snooze across density settings and redesigns.
  // Metrics are identical for every row — computed once per render, not per
  // row (150 getComputedStyle calls was measurable jank on large labels).
  let liMetricsCache = null;

  function syncLiMetrics(li, tb) {
    if (!liMetricsCache) {
      const ref = tb.querySelector('li:not(.shelf-li)');
      if (!ref) return;
      const cs = getComputedStyle(ref);
      liMetricsCache = {
        width: cs.width, height: cs.height, padding: cs.padding,
        margin: cs.margin, verticalAlign: cs.verticalAlign
      };
    }
    const m = liMetricsCache;
    li.style.width = m.width;
    li.style.height = m.height;
    li.style.padding = m.padding;
    li.style.margin = m.margin;
    li.style.verticalAlign = m.verticalAlign;
  }

  // anchor-cell scan is a layout READ — batched over all rows before any
  // writes so the browser reflows once, not once per row
  function ensureAnchorCell(row) {
    let rcCell = row.querySelector('td.shelf-rc-cell');
    if (!rcCell || rcCell.offsetWidth < 8) {
      if (rcCell) rcCell.classList.remove('shelf-rc-cell');
      for (const td of row.children) {
        if (td.offsetWidth >= 8) { td.classList.add('shelf-rc-cell'); break; }
      }
    }
  }

  function adornRow(row, label, cardMode) {
    const tid = threadIdOf(row);
    if (!tid) return;
    // vertical-split card rows: buttons overlay as a floating pill (the
    // toolbar renders mid-card there and joining it shoves the content)
    if (row.classList.contains('shelf-cardrow') !== !!cardMode) {
      row.classList.toggle('shelf-cardrow', !!cardMode);
      row.querySelectorAll('.shelf-li').forEach((n) => n.remove()); // re-home buttons
    }

    // Gmail recycles row elements; reset our bits if the thread changed
    if (row.dataset.shelfTid && row.dataset.shelfTid !== tid) {
      const oldChip = row.querySelector('.shelf-chip');
      if (oldChip) oldChip.remove();
      row.querySelectorAll('.shelf-li').forEach((n) => n.remove());
    }
    row.dataset.shelfTid = tid;

    // --- note chip (all list views) ---
    const note = notes[tid];
    let chip = row.querySelector('.shelf-chip');
    if (note && note.text) {
      if (!chip) {
        const bog = row.querySelector('span.bog');
        if (bog) {
          chip = el('span', 'shelf-chip');
          chip.innerHTML = SVG.note + '<span class="shelf-chip-t"></span>';
          a11y(chip, 'Shelf note, edit');
          chip.addEventListener('mousedown', (e) => e.stopPropagation());
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tipHide();
            openNotePopover(row, chip.getBoundingClientRect());
          });
          chip.addEventListener('mouseenter', () => {
            const id = row.dataset.shelfTid;
            const n = id && notes[id];
            if (n && n.text) tipShow(n, chip.getBoundingClientRect());
          });
          chip.addEventListener('mouseleave', tipHide);
          bog.insertAdjacentElement('afterend', chip);
        }
      }
      if (chip) {
        const cls = 'shelf-chip' + (note.c ? ' shelf-c-' + note.c : '');
        if (chip.className !== cls) chip.className = cls;
        const ct = chip.querySelector('.shelf-chip-t');
        if (ct) ct.textContent = note.text;
      }
    } else if (chip) {
      chip.remove();
    }
    // labs.aging: quiet day-counter on filed threads (4d+, amber at 8d+)
    let ageEl = row.querySelector('.shelf-age');
    const asg = assignments[tid];
    if (labs.aging && asg && asg.t) {
      const days = Math.floor((Date.now() - asg.t) / 86400000);
      if (days >= 4) {
        if (!ageEl) {
          const anchor = row.querySelector('.shelf-chip') || row.querySelector('span.bog');
          if (anchor) {
            ageEl = el('span', 'shelf-age');
            anchor.insertAdjacentElement('afterend', ageEl);
          }
        }
        if (ageEl) {
          const txt = days + 'd';
          if (ageEl.textContent !== txt) ageEl.textContent = txt;
          ageEl.classList.toggle('shelf-age-hot', days >= 8);
          if (!ageEl.title) ageEl.title = 'Days since filed (Shelf)';
        }
      } else if (ageEl) {
        ageEl.remove();
      }
    } else if (ageEl) {
      ageEl.remove();
    }

    // colored left-edge tick when the note carries an explicitly chosen
    // color. A real span, NOT the cell's ::before — Gmail uses that pseudo
    // itself (and keeps it at opacity 0, which silently swallowed ours).
    const rcCls = note && note.text && note.c ? 'shelf-rc-' + note.c : null;
    for (const c of NOTE_COLORS) {
      row.classList.toggle('shelf-rc-' + c, rcCls === 'shelf-rc-' + c);
    }
    const anchor = row.querySelector('td.shelf-rc-cell');
    let tick = row.querySelector('.shelf-rc-tick');
    if (rcCls && anchor) {
      if (tick && tick.parentElement !== anchor) { tick.remove(); tick = null; }
      if (!tick) anchor.appendChild(el('span', 'shelf-rc-tick'));
    } else if (tick) {
      tick.remove();
    }
    // (anchor cell for row-edge indicators is maintained by ensureAnchorCell,
    // batched in render before any writes)

    // --- hover buttons ---
    if (!row.querySelector('.shelf-li')) {
      const noteBtn = el('span', 'shelf-btn shelf-btn-note');
      noteBtn.innerHTML = SVG.note;
      a11y(noteBtn, 'Note (Shelf), Alt+N');
      attachGTip(noteBtn, 'Note (Shelf) · Alt+N');
      noteBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
      noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        openNotePopover(row, noteBtn.getBoundingClientRect());
      });
      const assignBtn = el('span', 'shelf-btn shelf-btn-assign');
      assignBtn.innerHTML = SVG.shelf;
      a11y(assignBtn, 'Move to section, Alt+M', () => openAssignMenu(row, assignBtn.getBoundingClientRect()));
      attachGTip(assignBtn, 'Move to section · Alt+M');
      assignBtn.addEventListener('mousedown', (e) => startAssignInteraction(e, row, assignBtn));
      assignBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });

      const tb = row.querySelector('ul[role="toolbar"]');
      if (tb && !cardMode) {
        // one li per button, sized like Gmail's own, so they line up exactly
        for (const btn of [noteBtn, assignBtn]) {
          const li = el('li', 'shelf-li shelf-in-tb');
          li.appendChild(btn);
          syncLiMetrics(li, tb);
          tb.appendChild(li);
        }
      } else {
        const li = el('li', 'shelf-li shelf-float');
        li.appendChild(noteBtn);
        li.appendChild(assignBtn);
        const lastTd = row.lastElementChild;
        if (lastTd) lastTd.appendChild(li);
      }
    }
    const ab = row.querySelector('.shelf-btn-assign');
    if (ab) ab.classList.toggle('shelf-off', !label);
  }

  // -------------------------------------------------------------- canary ----
  // If Gmail's markup changes so thread ids can't be read anymore, everything
  // in Shelf silently no-ops. Surface that once instead of just vanishing.
  let canaryShown = false;

  function checkCanary(rows) {
    if (canaryShown || rows.length < 3) return;
    for (const r of rows) {
      if (threadIdOf(r)) return;
    }
    canaryShown = true;
    console.warn('[Shelf] Gmail layout not recognized — Shelf selectors may need an update.');
    recordDiag('canary: thread ids unreadable (' + rows.length + ' rows)');
    // floating banner, NOT a tbody row (see the pristine-tbody rule)
    const cn = el('div', 'shelf-hint shelf-canary');
    cn.innerHTML =
      '<div class="shelf-hint-b shelf-warn">' + SVG.note +
      '<span>Shelf can’t read Gmail’s current layout, so grouping and notes are paused. ' +
      'An extension update is probably needed.</span>' +
      '<span class="shelf-hint-x" title="Dismiss">✕</span></div>';
    const x = cn.querySelector('.shelf-hint-x');
    x.addEventListener('mousedown', (e) => e.stopPropagation());
    x.addEventListener('click', (e) => { e.stopPropagation(); cn.remove(); });
    document.body.appendChild(cn);
  }

  // -------------------------------------------------------------- render ----
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; render(); }, 60);
  }

  // Pre-paint render for Gmail-driven row churn (keyboard nav, return from an
  // email, list streaming). scheduleRender's 60ms setTimeout is a fresh task,
  // so the browser PAINTS Gmail's ungrouped date-order rows before we regroup
  // — that's the keyboard-nav flash. A rAF callback runs BEFORE the next
  // paint, so the regroup is never visible; it also coalesces several
  // mutation bursts in one frame into a single render.
  let syncRenderRAF = 0;
  function scheduleSyncRender() {
    if (syncRenderRAF) return;
    syncRenderRAF = requestAnimationFrame(() => { syncRenderRAF = 0; render(); });
    // rAF stalls in a hidden tab (where nothing paints anyway) — flush on a
    // timer so grouping isn't left stale when the tab is next shown
    setTimeout(() => {
      if (syncRenderRAF) { cancelAnimationFrame(syncRenderRAF); syncRenderRAF = 0; render(); }
    }, 80);
  }

  // ------------------------------------------------------- motion polish ----
  // FLIP: rows glide to their new position after a user files or reorders,
  // instead of teleporting. Only user actions animate — Gmail's own list
  // churn stays instant.
  let animateNextRender = false;

  function requestAnimatedRender() {
    animateNextRender = true;
    scheduleRender();
  }

  const reducedMotion = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  // brief settle-flash on the threads that just moved, so the eye lands there
  function flashThreads(tids) {
    if (!tids || !tids.length || reducedMotion()) return;
    const want = new Set(tids);
    setTimeout(() => {
      const tb = visibleThreadTable();
      if (!tb) return;
      for (const r of tb.querySelectorAll('tr.zA')) {
        const id = threadIdOf(r);
        if (id && want.has(id)) {
          r.classList.remove('shelf-flash');
          void r.offsetWidth; // restart the animation
          r.classList.add('shelf-flash');
          setTimeout(() => r.classList.remove('shelf-flash'), 1000);
        }
      }
    }, 280); // after the glide settles
  }

  // aria-checked is watched so the multi-select bar tracks checkbox changes
  const MO_OPTS = { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] };
  let mo = null;
  let observing = false;

  // The observer stays attached across renders. It used to disconnect for the
  // duration of each render and re-attach at rAF/+120ms — which opened a deaf
  // gap after EVERY render where real mutations (arriving mail included) were
  // silently lost until the 4s safety net. Flushing with takeRecords() at the
  // end of the render gives the same immunity to Shelf's own mutations with
  // zero deaf tail: anything that happens after the finally is seen.
  function pauseObserver() {
    // kept as the render bracket's entry half; attachment is not touched
  }
  function resumeObserver() {
    if (!mo) return;
    mo.takeRecords(); // discard the render's own mutations, undelivered
    if (!observing && document.body) {
      try { mo.observe(document.body, MO_OPTS); observing = true; } catch (e) {}
    }
  }

  function render() {
    const label = currentLabel();
    // Hidden: draw nothing at all, keep only the toggle so it can come back.
    // Stored sections and notes are untouched — this is a view switch, not a
    // delete, which is the whole point of the button.
    if (shelfHidden) {
      if (!toreDown) { teardownAll(); toreDown = true; }
      updateHideButton(label, toolbarAnchor(label));
      return;
    }
    toreDown = false;
    updateConvNote();
    const table = visibleThreadTable();
    const topAdd = updateAddButton(label);
    updateHideButton(label, toolbarAnchor(label));
    if (!table) {
      // No list on screen (a conversation is open, settings, etc.). Leave the
      // hidden list's layout — transforms, headers, margins — fully intact:
      // Gmail re-shows the same cached table on Back, so the grouping is
      // already in place and the return paints grouped on the first frame.
      // Tearing down here is what caused the ungrouped flash on Back-nav.
      updateMultiBar(null, null);
      return;
    }

    const allRows = Array.prototype.slice.call(table.querySelectorAll('tr.zA'));
    if (!allRows.length) { cleanupHeaders(); removeHint(); removeReview(); removeDonate(); removeAdd(); updateMultiBar(null, null); return; }
    checkCanary(allRows);

    pauseObserver();
    try {
      // Gmail owns the tbody outright (see the pristine-tbody rule at the
      // headers section): rows are never moved, removed, or deduped here.
      const rows = allRows;
      liMetricsCache = null; // density may have changed between renders
      const cardMode = cardRows(table); // batched layout reads first
      for (const row of rows) ensureAnchorCell(row);
      updateMultiBar(label, table);
      for (const row of rows) adornRow(row, label, cardMode);

      if (!label) { cleanupHeaders(); removeHint(); removeReview(); removeDonate(); removeAdd(); return; }
      const cfg = labelCfg(label, false);
      const tbody = rows[0].parentElement;
      if (!tbody) return;
      applyRules(label, rows); // labs: no-op unless enabled
      // Split view: Gmail resolves row clicks by POSITION within the table,
      // so injected rows (headers, banners) and re-sorted rows corrupt its
      // click map — dead clicks, wrong selection, duplicate "zombie" rows.
      // Everything that adds or moves tbody rows pauses here; notes, chips,
      // filing and the conversation strip all keep working. The same hazard
      // exists whenever a view renders MULTIPLE thread tables (Priority
      // Inbox, Multiple Inboxes), so those pause too.
      if (readingPaneActive() || multiplePanes()) {
        cleanupHeaders();
        removeHint();
        removeReview();
        removeDonate();
        removeAdd();
        if (addBtnEl && addBtnEl.isConnected) addBtnEl.remove();
        splitNotice(cfg);
        return;
      }
      // banners stack above the list, mutually exclusive by priority
      const hintB = updateHint(label, cfg);
      const reviewB = updateReviewAsk(label, !!hintB);
      const donateB = updateDonateAsk(label, !!(hintB || reviewB));
      const deadB = updateDeadBanner();
      const banners = [deadB, hintB, reviewB, donateB].filter(Boolean);
      if (!cfg.list.length) {
        // no grouping: rows stay in Gmail's natural order; only banners and
        // the add-section fallback float in the overlay
        for (const hdEl of headerEls.values()) { if (hdEl.isConnected) hdEl.remove(); }
        document.querySelectorAll('tr.zA.shelf-hidden').forEach((r) => r.classList.remove('shelf-hidden'));
        const addE = topAdd ? (removeAdd(), null) : updateAddRow(label);
        const seqEls = banners.concat(rows).concat(addE ? [addE] : []);
        if (banners.length || addE) layoutVisual(table, tbody, seqEls, false);
        else cleanupHeaders();
        return;
      }

      const byId = new Map(cfg.list.map((s) => [s.id, []]));
      let rest = [];
      for (const row of rows) {
        const tid = threadIdOf(row);
        const a = tid && assignments[tid];
        if (a && byId.has(a.s)) byId.get(a.s).push(row);
        else rest.push(row);
      }
      // manual order within a bucket: unranked rows (new arrivals) stay first
      // in Gmail's natural order, then explicitly placed rows by their rank.
      // pinnedTo names the bucket a rank is valid for, so a leftover rank from
      // a since-deleted section never reorders the "Everything else" pile.
      const orderBucket = (b, pinnedTo) => {
        if (b.length < 2) return b;
        const ranked = [];
        const unranked = [];
        for (const row of b) {
          const a = assignments[row.dataset.shelfTid];
          if (a && a.r != null && a.s === pinnedTo) ranked.push(row); else unranked.push(row);
        }
        if (!ranked.length) return b;
        ranked.sort((x, y) =>
          assignments[x.dataset.shelfTid].r - assignments[y.dataset.shelfTid].r);
        return unranked.concat(ranked);
      };
      for (const s of cfg.list) byId.set(s.id, orderBucket(byId.get(s.id), s.id));
      rest = orderBucket(rest, ':else');

      const seq = [];
      const pushBucket = (h, bucket, collapsed) => {
        seq.push(h);
        for (const r of bucket) {
          r.classList.toggle('shelf-hidden', !!collapsed);
          seq.push(r);
        }
      };
      const secById = new Map(cfg.list.map((s) => [s.id, s]));
      const renderSection = (s, asChild, parentCollapsed, parentColor) => {
        const bucket = byId.get(s.id);
        const kids = childrenOf(cfg, s.id);
        let total = bucket.length;
        for (const k of kids) total += byId.get(k.id).length;
        // a sub-header wears a chip in the family color (its own, or the
        // parent's) and sits indented — that shared color + indent is the
        // whole nesting signal; no rails, no lines. No fallback to gray: an
        // uncolored sub under an uncolored parent stays plain, matching it
        // (gray only when the parent is genuinely gray).
        const chipC = asChild ? (s.c || parentColor) : s.c;
        if (!parentCollapsed) {
          const h = headerFor(label, s.id);
          h.classList.toggle('shelf-sub', !!asChild);
          updateHeader(h, s.name, total, s.collapsed, false, chipC);
          seq.push(h);
        }
        const hideRows = parentCollapsed || !!s.collapsed;
        for (const r of bucket) {
          r.classList.toggle('shelf-hidden', hideRows);
          seq.push(r);
        }
        for (const k of kids) renderSection(k, true, parentCollapsed || !!s.collapsed, s.c);
      };
      for (const id of combinedIds(cfg)) {
        if (id === ':else') {
          const hElse = headerFor(label, ':else');
          updateHeader(hElse, cfg.elseName || 'Everything else', rest.length, cfg.elseCollapsed, true, cfg.elseColor);
          pushBucket(hElse, rest, cfg.elseCollapsed);
        } else {
          renderSection(secById.get(id), false, false, null);
        }
      }

      // remove headers that no longer belong (deleted sections, other labels)
      for (const hdEl of headerEls.values()) {
        if (hdEl.isConnected && seq.indexOf(hdEl) < 0) hdEl.remove();
      }

      const addE = topAdd ? (removeAdd(), null) : updateAddRow(label); // fallback stays last
      const seqEls = banners.concat(seq).concat(addE ? [addE] : []);
      const changed = !lastSeq || lastSeq.length !== seqEls.length ||
        seqEls.some((n, i) => lastSeq[i] !== n);
      if (changed) log('regrouped', label, cfg.list.map((s) => s.name));
      lastSeq = seqEls;
      const wantAnim = animateNextRender && changed;
      animateNextRender = false;
      layoutVisual(table, tbody, seqEls, wantAnim);

      updateThemeClass(rows[0]);
    } catch (err) {
      // a render crash must never take Shelf down silently
      console.error('[Shelf] render failed:', err);
      recordDiag('render: ' + (err && err.message ? err.message : err));
    } finally {
      resumeObserver();
    }
  }

  // --------------------------------------------------------------- theme ----
  function updateThemeClass(sampleRow) {
    // Image themes put photos behind translucent rows, so background sampling
    // lies. Gmail's own text color is always solid and always theme-correct:
    // light subject text means a dark surface, whatever sits behind it.
    const bog = sampleRow.querySelector('span.bog');
    if (bog) {
      const m = getComputedStyle(bog).color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
        document.documentElement.classList.toggle('shelf-dark', lum > 150);
        return;
      }
    }
    // fallback: walk up for a solid background (rows without a subject span)
    let node = sampleRow;
    let bg = null;
    while (node && node !== document.documentElement) {
      const c = getComputedStyle(node).backgroundColor;
      const m2 = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m2 && (m2[4] === undefined || parseFloat(m2[4]) > 0.5)) { bg = m2; break; }
      node = node.parentElement;
    }
    if (!bg) return;
    const lum = 0.299 * +bg[1] + 0.587 * +bg[2] + 0.114 * +bg[3];
    document.documentElement.classList.toggle('shelf-dark', lum < 128);
  }

  // ---------------------------------------------------------------- init ----
  (async function init() {
    await loadState();
    // Fast path: when Gmail adds/replaces thread rows (entering a view,
    // list refresh), render synchronously inside the mutation callback —
    // it runs before the next paint, so users never see a flash of
    // Gmail-ordered rows jumping into shelves. Throttled; everything else
    // takes the debounced path.
    let lastSyncRender = 0;
    mo = new MutationObserver((records) => {
      let rowsChanged = false;
      for (const rec of records) {
        if (rec.type !== 'childList') continue;
        for (const n of rec.addedNodes) {
          if (n.nodeType !== 1) continue;
          if ((n.matches && n.matches('tr.zA')) ||
              (n.querySelector && n.querySelector('tr.zA'))) {
            rowsChanged = true;
            break;
          }
        }
        if (rowsChanged) break;
      }
      const now = Date.now();
      if (rowsChanged && now - lastSyncRender > 150) {
        // occasional change — regroup immediately in this microtask (pre-paint)
        lastSyncRender = now;
        render();
      } else if (rowsChanged) {
        // rapid successive churn (holding j/k) — coalesce to the next frame.
        // Still PRE-paint, so no flash; was a 60ms post-paint setTimeout.
        scheduleSyncRender();
      } else {
        // a non-row mutation (e.g. aria-checked for multi-select) — no
        // reordering to hide, so the cheaper async path is fine
        scheduleRender();
      }
    });
    if (document.body) {
      mo.observe(document.body, MO_OPTS);
      observing = true;
    }
    rowDragInit();
    window.addEventListener('hashchange', () => {
      closeOverlay();
      setTimeout(scheduleRender, 60);
      convCatchUp();
    });
    // safety net: cheap idempotent re-render in case the observer missed a swap
    setInterval(() => {
      if (document.visibilityState === 'visible') scheduleRender();
    }, 4000);
    scheduleRender();
    convCatchUp(); // deep link / reload with a conversation already open
    log('Shelf initialized');
  })();
})();
