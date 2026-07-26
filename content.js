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
    shelf: '<svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h10v2H4v-2z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm17.7-2.12c.39.39.39 1.02 0 1.41l-.71.71-2.12-2.12.71-.71c.39-.39 1.02-.39 1.41 0l.71.71zm-3.54.71 2.12 2.12-5.3 5.29H12v-2.12l5.16-5.29z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 5.5 12.7 4.1 14.1 9 19 20 8l-1.4-1.4z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>'
  };

  // -------------------------------------------------------------- state ----
  // sections:    { [label]: { list: [{id, name, collapsed}], elseCollapsed } }
  // assignments: { [threadId]: { s: sectionId, t: timestamp } }
  // notes:       { [threadId]: { text, t } }   (stored as individual 'note:<id>' keys)
  let sections = {};
  let assignments = {};
  let notes = {};

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

  function updateDeadBanner(tbody) {
    if (!contextDead || deadDismissed) return;
    if (!deadEl) {
      deadEl = el('tr', 'shelf-hint');
      const td = document.createElement('td');
      td.colSpan = 50;
      td.innerHTML =
        '<div class="shelf-hint-b shelf-warn">' + SVG.shelf +
        '<span>Shelf was updated in the background — <b>reload this tab</b> so your changes keep saving.</span>' +
        '<span class="shelf-hint-x" title="Dismiss">✕</span></div>';
      deadEl.appendChild(td);
      const x = td.querySelector('.shelf-hint-x');
      a11y(x, 'Dismiss');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        deadDismissed = true;
        deadEl.remove();
      });
    }
    if (tbody.firstChild !== deadEl) tbody.insertBefore(deadEl, tbody.firstChild);
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
      notes[threadId] = { text, t: Date.now() };
      if (color) notes[threadId].c = color; // absent = plain (subtle gray)
      // keep the rich version only when it actually carries formatting
      if (html && html.indexOf('<') !== -1) notes[threadId].h = html;
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
  const headerEls = new Map(); // keyed by hkey(label, sectionId)
  // NUL separator: labels may contain spaces, so ' ' would be ambiguous
  const hkey = (label, sectionId) => label + '\u0000' + sectionId;

  function headerFor(label, sectionId) {
    const key = hkey(label, sectionId);
    let tr = headerEls.get(key);
    if (tr) return tr;
    tr = el('tr', 'shelf-header');
    tr.dataset.shelfSection = sectionId;
    tr.dataset.shelfLabel = label;
    const td = document.createElement('td');
    td.colSpan = 50;
    td.innerHTML =
      '<div class="shelf-h">' +
      '<span class="shelf-chevron">' + SVG.chevron + '</span>' +
      '<span class="shelf-h-pill">' +
      '<span class="shelf-name"></span>' +
      '<span class="shelf-count"></span>' +
      '</span>' +
      '<span class="shelf-spacer"></span>' +
      '<span class="shelf-more">' + SVG.dots + '</span>' +
      '</div>';
    tr.appendChild(td);

    const h = td.querySelector('.shelf-h');
    a11y(h);
    h.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(tr.dataset.shelfLabel, tr.dataset.shelfSection);
    });
    h.addEventListener('mousedown', (e) => startHeaderDrag(e, tr));
    const more = td.querySelector('.shelf-more');
    a11y(more, 'Section options');
    attachGTip(more, 'Section options');
    more.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      openHeaderMenu(tr.dataset.shelfLabel, tr.dataset.shelfSection, more.getBoundingClientRect());
    });

    headerEls.set(key, tr);
    return tr;
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

  function cleanupHeaders() {
    for (const trEl of headerEls.values()) {
      if (trEl.isConnected) trEl.remove();
    }
    document.querySelectorAll('tr.zA.shelf-hidden').forEach((r) => r.classList.remove('shelf-hidden'));
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

  // place tids at a precise position inside a section (before beforeTid, or
  // at the end when beforeTid is null), renumbering the whole bucket so
  // ranks stay simple integers
  async function assignManyAt(tids, sectionId, beforeTid) {
    const now = Date.now();
    const moving = new Set(tids);
    const order = [];
    const tb = visibleThreadTable();
    if (tb) {
      for (const row of tb.querySelectorAll('tr.zA')) {
        const id = threadIdOf(row);
        const a = id && assignments[id];
        if (a && a.s === sectionId && !moving.has(id)) order.push(id);
      }
    }
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
      mi.addEventListener('click', (e) => { e.stopPropagation(); opts.onClick(mi); });
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
          onClick: () => { closeOverlay(); assignMany(tids, s.id); }
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
  // notes default to a quiet, plain look; color is opt-in emphasis. Gray is
  // omitted here because plain already looks gray (it stays for shelves).
  const NOTE_PALETTE = ['yellow', 'red', 'green', 'blue'];

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

  function renderNoteInto(node, note) {
    if (!node || !note) return;
    if (note.h) { if (node.innerHTML !== note.h) node.innerHTML = note.h; }
    else if (node.textContent !== note.text) node.textContent = note.text;
  }

  function makeFmtBar(onLink) {
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
    const save = () => saveNote(tid, ed.textContent, color, sanitizeNoteHtml(ed.innerHTML)).then(scheduleRender);

    let linkRow;
    const tools = el('div', 'shelf-pop-tools');
    tools.appendChild(makeFmtBar(() => linkRow.open()));
    tools.appendChild(makeSwatches(color, (c) => {
      color = c;
      if (timer) { clearTimeout(timer); timer = null; }
      save();
    }, true, NOTE_PALETTE));
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

    ed.addEventListener('input', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; save(); }, 500);
    });
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
      }
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
        gtipEl = el('div', 'shelf-gtip', text);
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

  // ------------------------------------------------------ click ownership ----
  // We reorder Gmail's row elements, but Gmail's internal click→thread
  // binding assumes its own ordering; after Gmail recycles rows it can open
  // the WRONG conversation. In views where Shelf has sections, we intercept
  // plain left-clicks on rows and navigate by the thread id the row actually
  // displays — read fresh at click time, so it can never desync.
  function navExempt(t) {
    return !!(t && t.closest && t.closest(
      '[role="checkbox"], [role="button"], [role="link"], a, button, input, ' +
      'ul[role="toolbar"], .shelf-li, .shelf-chip, .shelf-menu, .shelf-pop, ' +
      '.shelf-hint, .shelf-multibar'));
  }

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const label = currentLabel();
    if (!label) return; // search results etc. — Gmail's own handling is fine
    if (!labelCfg(label, false).list.length) return; // we never reordered here
    const row = e.target && e.target.closest ? e.target.closest('tr.zA') : null;
    if (!row || !row.closest('table.F') || navExempt(e.target)) return;
    const tid = threadIdOf(row);
    if (!tid) return;
    e.preventDefault();
    e.stopPropagation();
    const base = /^#inbox/.test(location.hash)
      ? '#inbox'
      : (location.hash.match(/^#label\/[^/?]+/) || ['#inbox'])[0];
    log('nav: opening', tid, 'from row click');
    location.hash = base + '/' + tid;
  }, true);

  // ---------------------------------------------------- keyboard shortcuts ----
  // Alt-combos avoid every one of Gmail's single-key bindings. Alt+N = note,
  // Alt+M = move to section — acting on the hovered row (or, for Alt+N, the
  // open conversation). e.code is used so macOS Option-char mapping is moot.
  let kbdHoverRow = null;

  document.addEventListener('mouseover', (e) => {
    const r = e.target && e.target.closest ? e.target.closest('tr.zA') : null;
    if (r) kbdHoverRow = r;
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.code !== 'KeyN' && e.code !== 'KeyM') return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
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
    if (!kbdHoverRow || !kbdHoverRow.isConnected || !kbdHoverRow.offsetParent) return;
    e.preventDefault();
    e.stopPropagation();
    tipHide();
    if (e.code === 'KeyN') {
      const anchor = kbdHoverRow.querySelector('.shelf-btn-note') || kbdHoverRow;
      openNotePopover(kbdHoverRow, anchor.getBoundingClientRect());
    } else {
      const anchor = kbdHoverRow.querySelector('.shelf-btn-assign') || kbdHoverRow;
      openAssignMenu(kbdHoverRow, anchor.getBoundingClientRect());
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
      const tr = under && under.closest ? under.closest('tr.shelf-header, tr.zA') : null;
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
        const tr = n.closest ? n.closest('tr.shelf-header') : null;
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
        // over a thread row: offer precise placement within its section
        const hov = rowUnder(ev.clientX, ev.clientY);
        if (hov && dimmed && dimmed.indexOf(hov) === -1) {
          const hid = threadIdOf(hov);
          const a = hid && assignments[hid];
          const cfgNow = labelCfg(currentLabel() || '', false);
          if (a && cfgNow.list.some((s) => s.id === a.s)) {
            const r = hov.getBoundingClientRect();
            const upper = ev.clientY < r.top + r.height / 2;
            let beforeTid = hid;
            if (!upper) {
              const next = hov.nextElementSibling;
              const nid = next && next.classList && next.classList.contains('zA') ? threadIdOf(next) : null;
              const na = nid && assignments[nid];
              beforeTid = na && na.s === a.s ? nid : null;
            }
            posTarget = { sectionId: a.s, beforeTid };
            showInsLine({ top: (upper ? r.top : r.bottom) - 1, left: r.left, width: r.width });
          }
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
  let hintDone = false;
  let hintEl = null;
  // One-time review ask — earned, not begged: only after retained, repeated
  // use. All three must hold: a week since install, 30+ threads filed, and
  // filing activity on 4+ distinct days (a binge test day doesn't qualify).
  const REVIEW_MIN_FILES = 30;
  const REVIEW_MIN_ACTIVE_DAYS = 4;
  const REVIEW_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  let fileCount = 0;
  let fileDays = [];
  let firstUse = 0;
  let reviewDone = false;
  let reviewEl = null;
  // Second-stage, once-ever donation nudge: only after the review ask has
  // been resolved and the user is deeply retained. Dormant until the Ko-fi
  // URL below is configured (no dead links if launched before setup).
  const DONATE_URL = 'https://ko-fi.com/YOUR_PAGE_HERE';
  const DONATE_MIN_FILES = 100;
  const DONATE_MIN_ACTIVE_DAYS = 10;
  const DONATE_MIN_AGE_MS = 21 * 24 * 60 * 60 * 1000;
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

  function updateHint(label, cfg, tbody) {
    if (!label || hintDone || cfg.list.length) { removeHint(); return; }
    if (!hintEl) {
      hintEl = el('tr', 'shelf-hint');
      const td = document.createElement('td');
      td.colSpan = 50;
      td.innerHTML =
        '<div class="shelf-hint-b">' + SVG.shelf +
        '<span>Hover a thread, then click the ☰ icon to file it under your first section.</span>' +
        '<span class="shelf-hint-x" title="Dismiss">✕</span></div>';
      hintEl.appendChild(td);
      const x = td.querySelector('.shelf-hint-x');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); markHintDone(); });
    }
    if (tbody.firstChild !== hintEl) tbody.insertBefore(hintEl, tbody.firstChild);
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

  function updateReviewAsk(label, tbody) {
    const engaged = fileCount >= REVIEW_MIN_FILES &&
      fileDays.length >= REVIEW_MIN_ACTIVE_DAYS &&
      firstUse > 0 && (Date.now() - firstUse) >= REVIEW_MIN_AGE_MS;
    const show = !!label && !reviewDone && engaged &&
      !(hintEl && hintEl.isConnected) && !canaryShown;
    if (!show) { removeReview(); return; }
    if (!reviewEl) {
      reviewEl = el('tr', 'shelf-hint');
      const td = document.createElement('td');
      td.colSpan = 50;
      td.innerHTML =
        '<div class="shelf-hint-b shelf-review">' + SVG.shelf +
        '<span>Enjoying Shelf? A quick review genuinely helps.</span>' +
        '<a class="shelf-review-a" target="_blank" rel="noopener">Write a review</a>' +
        '<span class="shelf-hint-x" title="No thanks">✕</span></div>';
      reviewEl.appendChild(td);
      const a = td.querySelector('.shelf-review-a');
      try {
        if (chrome.runtime && chrome.runtime.id) {
          a.href = 'https://chromewebstore.google.com/detail/' + chrome.runtime.id + '/reviews';
        }
      } catch (e) {}
      a.addEventListener('mousedown', (e) => e.stopPropagation());
      a.addEventListener('click', (e) => { e.stopPropagation(); markReviewDone(); });
      const x = td.querySelector('.shelf-hint-x');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); markReviewDone(); });
    }
    if (tbody.firstChild !== reviewEl) tbody.insertBefore(reviewEl, tbody.firstChild);
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

  function updateDonateAsk(label, tbody) {
    const configured = DONATE_URL.indexOf('YOUR_PAGE_HERE') === -1;
    const engaged = fileCount >= DONATE_MIN_FILES &&
      fileDays.length >= DONATE_MIN_ACTIVE_DAYS &&
      firstUse > 0 && (Date.now() - firstUse) >= DONATE_MIN_AGE_MS;
    const show = configured && !!label && !donateDone && reviewDone && engaged &&
      !(hintEl && hintEl.isConnected) && !(reviewEl && reviewEl.isConnected) && !canaryShown;
    if (!show) { removeDonate(); return; }
    if (!donateEl) {
      donateEl = el('tr', 'shelf-hint');
      const td = document.createElement('td');
      td.colSpan = 50;
      td.innerHTML =
        '<div class="shelf-hint-b shelf-review">' + SVG.shelf +
        '<span>Shelf is free, with no company behind it. If it has earned its keep:</span>' +
        '<a class="shelf-review-a" target="_blank" rel="noopener">☕ Buy me a coffee</a>' +
        '<span class="shelf-hint-x" title="No thanks">✕</span></div>';
      donateEl.appendChild(td);
      const a = td.querySelector('.shelf-review-a');
      a.href = DONATE_URL;
      a.addEventListener('mousedown', (e) => e.stopPropagation());
      a.addEventListener('click', (e) => { e.stopPropagation(); markDonateDone(); });
      const x = td.querySelector('.shelf-hint-x');
      x.addEventListener('mousedown', (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); markDonateDone(); });
    }
    if (tbody.firstChild !== donateEl) tbody.insertBefore(donateEl, tbody.firstChild);
  }

  // ------------------------------------------------------ add-section row ----
  let addEl = null;

  function removeAdd() {
    if (addEl && addEl.isConnected) addEl.remove();
  }

  function updateAddRow(label, tbody) {
    if (!label) { removeAdd(); return; }
    if (!addEl) {
      addEl = el('tr', 'shelf-add');
      const td = document.createElement('td');
      td.colSpan = 50;
      td.innerHTML = '<div class="shelf-add-b">' + SVG.plus + '<span>New section</span></div>';
      addEl.appendChild(td);
      const b = td.querySelector('.shelf-add-b');
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
        const r = b.getBoundingClientRect();
        openOverlay(menu, r.left, r.bottom + 6);
      });
    }
    if (tbody.lastChild !== addEl) tbody.appendChild(addEl);
  }

  // Preferred placement: a small "+" in the list toolbar, after the ⋮ button.
  // Falls back to the bottom-of-list row when the toolbar can't be found
  // (e.g. non-English Gmail, or a Gmail redesign).
  let addBtnEl = null;

  function updateAddButton(label) {
    let anchor = null;
    if (label) {
      const refresh = Array.prototype.find.call(
        document.querySelectorAll('[data-tooltip="Refresh"], [aria-label="Refresh"]'),
        (n) => n.offsetParent);
      if (refresh) {
        const ct = refresh.closest('[gh="tm"]') ||
          (refresh.parentElement && refresh.parentElement.parentElement);
        if (ct) {
          const more = Array.prototype.find.call(
            ct.querySelectorAll('[data-tooltip="More"], [aria-label="More"]'),
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
      addBtnEl.innerHTML = SVG.plus;
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

    // toolbar button, aligned by mirroring the ⋮ button's box
    const more = Array.prototype.find.call(
      document.querySelectorAll('[data-tooltip="More"], [aria-label="More"]'),
      (n) => n.offsetParent);
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
    renderNoteInto(strip.querySelector('.shelf-note-strip-t'), note);
  }

  function ensureStrip(h2, tid) {
    let strip = h2.parentElement && h2.parentElement.querySelector('.shelf-note-strip');
    if (!strip) {
      strip = el('div', 'shelf-note-strip');
      strip.innerHTML = SVG.note + '<span class="shelf-note-strip-t"></span>';
      strip.addEventListener('mousedown', (e) => e.stopPropagation());
      strip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target && e.target.closest && e.target.closest('a')) return; // follow the link
        if (strip.dataset.tid) startStripEdit(strip, strip.dataset.tid);
      });
      h2.insertAdjacentElement('afterend', strip);
    }
    if (strip.dataset.tid !== tid) strip.dataset.tid = tid;
    return strip;
  }

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
    tools.appendChild(makeFmtBar(() => linkRow.open()));
    tools.appendChild(makeSwatches(color, (c) => {
      color = c;
      strip.className = 'shelf-note-strip shelf-editing' + (c ? ' shelf-c-' + c : '');
    }, true, NOTE_PALETTE));
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

  function adornRow(row, label) {
    const tid = threadIdOf(row);
    if (!tid) return;

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
    // colored left edge when the note carries an explicitly chosen color
    const rcCls = note && note.text && note.c ? 'shelf-rc-' + note.c : null;
    for (const c of NOTE_COLORS) {
      row.classList.toggle('shelf-rc-' + c, rcCls === 'shelf-rc-' + c);
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
      if (tb) {
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
    const tbody = rows[0].parentElement;
    if (!tbody) return;
    const tr = el('tr', 'shelf-hint');
    const td = document.createElement('td');
    td.colSpan = 50;
    td.innerHTML =
      '<div class="shelf-hint-b shelf-warn">' + SVG.note +
      '<span>Shelf can’t read Gmail’s current layout, so grouping and notes are paused. ' +
      'An extension update is probably needed.</span>' +
      '<span class="shelf-hint-x" title="Dismiss">✕</span></div>';
    tr.appendChild(td);
    const x = td.querySelector('.shelf-hint-x');
    x.addEventListener('mousedown', (e) => e.stopPropagation());
    x.addEventListener('click', (e) => { e.stopPropagation(); tr.remove(); });
    tbody.insertBefore(tr, tbody.firstChild);
  }

  // -------------------------------------------------------------- render ----
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; render(); }, 60);
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

  function flipAnimate(nodes, oldTops) {
    if (reducedMotion()) return;
    const moved = [];
    for (const nd of nodes) {
      const old = oldTops.get(nd);
      if (old == null || !nd.isConnected) continue;
      const dy = old - nd.getBoundingClientRect().top;
      if (Math.abs(dy) < 2) continue;
      nd.style.transform = 'translateY(' + dy + 'px)';
      nd.style.transition = 'none';
      moved.push(nd);
    }
    if (!moved.length) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      for (const nd of moved) {
        nd.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
        nd.style.transform = '';
      }
    };
    requestAnimationFrame(start);
    setTimeout(start, 50); // rAF stalls in background tabs
    setTimeout(() => {
      for (const nd of moved) {
        nd.style.transition = '';
        nd.style.transform = '';
      }
    }, 400);
  }

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

  function pauseObserver() {
    if (mo && observing) { mo.disconnect(); observing = false; }
  }
  function resumeObserver() {
    if (!mo || observing) return;
    const go = () => {
      if (mo && !observing && document.body) {
        try { mo.observe(document.body, MO_OPTS); observing = true; } catch (e) {}
      }
    };
    requestAnimationFrame(go);
    // rAF stalls in background tabs — without this fallback the observer
    // could stay disconnected while Gmail churns in a hidden tab
    setTimeout(go, 120);
  }

  function render() {
    const label = currentLabel();
    updateConvNote();
    const table = visibleThreadTable();
    const topAdd = updateAddButton(label);
    if (!table) { cleanupHeaders(); removeHint(); removeReview(); removeDonate(); removeAdd(); updateMultiBar(null, null); return; }

    const rows = Array.prototype.slice.call(table.querySelectorAll('tr.zA'));
    if (!rows.length) { cleanupHeaders(); removeHint(); removeReview(); removeDonate(); removeAdd(); updateMultiBar(null, null); return; }
    checkCanary(rows);

    pauseObserver();
    try {
      liMetricsCache = null; // density may have changed between renders
      for (const row of rows) ensureAnchorCell(row); // batched layout reads first
      updateMultiBar(label, table);
      for (const row of rows) adornRow(row, label);

      if (!label) { cleanupHeaders(); removeHint(); removeReview(); removeDonate(); removeAdd(); return; }
      const cfg = labelCfg(label, false);
      const tbody = rows[0].parentElement;
      if (!tbody) return;
      updateHint(label, cfg, tbody);
      updateReviewAsk(label, tbody);
      updateDonateAsk(label, tbody);
      updateDeadBanner(tbody);
      if (!cfg.list.length) {
        cleanupHeaders();
        if (topAdd) removeAdd(); else updateAddRow(label, tbody);
        return;
      }

      const byId = new Map(cfg.list.map((s) => [s.id, []]));
      const rest = [];
      for (const row of rows) {
        const tid = threadIdOf(row);
        const a = tid && assignments[tid];
        if (a && byId.has(a.s)) byId.get(a.s).push(row);
        else rest.push(row);
      }
      // within-section manual order: unranked rows (new arrivals) first in
      // Gmail's natural order, then explicitly ranked rows by their rank
      for (const s of cfg.list) {
        const b = byId.get(s.id);
        if (b.length < 2) continue;
        const ranked = [];
        const unranked = [];
        for (const row of b) {
          const a = assignments[row.dataset.shelfTid];
          if (a && a.r != null) ranked.push(row); else unranked.push(row);
        }
        if (!ranked.length) continue;
        ranked.sort((x, y) =>
          assignments[x.dataset.shelfTid].r - assignments[y.dataset.shelfTid].r);
        byId.set(s.id, unranked.concat(ranked));
      }

      const seq = [];
      const pushBucket = (h, bucket, collapsed) => {
        seq.push(h);
        for (const r of bucket) {
          r.classList.toggle('shelf-hidden', !!collapsed);
          setSubRail(r, null);
          seq.push(r);
        }
      };
      const secById = new Map(cfg.list.map((s) => [s.id, s]));
      // sub-shelf rows carry a side-wall rail in the family color, so the
      // contents read as nested even though table rows can't be indented
      const setSubRail = (r, c) => {
        r.classList.toggle('shelf-in-sub', !!c);
        for (const cc of NOTE_COLORS) r.classList.toggle('shelf-subrail-' + cc, c === cc);
      };
      const renderSection = (s, asChild, parentCollapsed, parentColor) => {
        const bucket = byId.get(s.id);
        const kids = childrenOf(cfg, s.id);
        let total = bucket.length;
        for (const k of kids) total += byId.get(k.id).length;
        // the bracket/side-wall inherits the parent's color unless the child
        // has its own — visible family membership either way
        const railC = asChild ? (s.c || parentColor || 'gray') : null;
        if (!parentCollapsed) {
          const h = headerFor(label, s.id);
          h.classList.toggle('shelf-sub', !!asChild);
          for (const c of NOTE_COLORS) h.classList.toggle('shelf-rail-' + c, railC === c && railC !== 'gray');
          updateHeader(h, s.name, total, s.collapsed, false, s.c);
          seq.push(h);
        }
        const hideRows = parentCollapsed || !!s.collapsed;
        for (const r of bucket) {
          r.classList.toggle('shelf-hidden', hideRows);
          setSubRail(r, railC);
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
      for (const trEl of headerEls.values()) {
        if (trEl.isConnected && seq.indexOf(trEl) < 0) trEl.remove();
      }

      // apply order only if it differs (keeps mutation churn near zero)
      const cur = Array.prototype.filter.call(tbody.children, (c) =>
        c.classList.contains('zA') || c.classList.contains('shelf-header'));
      const same = cur.length === seq.length && cur.every((c, i) => c === seq[i]);
      const wantAnim = animateNextRender && !same;
      animateNextRender = false;
      let oldTops = null;
      if (wantAnim) {
        oldTops = new Map();
        for (const nd of seq) {
          if (nd.isConnected) oldTops.set(nd, nd.getBoundingClientRect().top);
        }
      }
      if (!same) {
        for (const node of seq) tbody.appendChild(node);
        log('regrouped', label, cfg.list.map((s) => s.name));
      }
      if (oldTops) flipAnimate(seq, oldTops);

      if (topAdd) removeAdd(); else updateAddRow(label, tbody); // fallback stays the last row
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
        lastSyncRender = now;
        render();
      } else {
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
    });
    // safety net: cheap idempotent re-render in case the observer missed a swap
    setInterval(() => {
      if (document.visibilityState === 'visible') scheduleRender();
    }, 4000);
    scheduleRender();
    log('Shelf initialized');
  })();
})();
