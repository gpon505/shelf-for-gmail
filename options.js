// Shelf — backup (export/import) page. Reads/writes chrome.storage.local
// (the source of truth) and mirrors imports to sync best-effort.
(() => {
  'use strict';

  const KNOWN = (k) =>
    k === 'sections' || k === 'sectionsRev' || k === 'assignments' ||
    k === 'hintDone' || k === 'rules' || k === 'labs' ||
    k === 'shelfHidden' || k.indexOf('note:') === 0;

  function status(msg, err) {
    const s = document.getElementById('status');
    s.textContent = msg;
    s.className = err ? 'err' : '';
  }

  document.getElementById('export').addEventListener('click', () => {
    chrome.storage.local.get(null, (all) => {
      const data = {};
      for (const k of Object.keys(all || {})) {
        if (KNOWN(k)) data[k] = all[k];
      }
      const payload = {
        app: 'shelf',
        version: 1,
        exportedAt: new Date().toISOString(),
        data
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shelf-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      status('Exported ' + Object.keys(data).length + ' entries.');
    });
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  // privacy-safe bug-report helper: version + data sizes + the local error
  // ring buffer. Nothing is transmitted; the user pastes it where they choose.
  document.getElementById('diag').addEventListener('click', () => {
    chrome.storage.local.get(null, (all) => {
      all = all || {};
      const sections = all.sections || {};
      const lines = [
        'Shelf diagnostics',
        'version: ' + chrome.runtime.getManifest().version,
        'browser: ' + navigator.userAgent,
        'views with sections: ' + Object.keys(sections).length,
        'sections: ' + Object.keys(sections).reduce((n, k) => n + ((sections[k].list || []).length), 0),
        'assignments: ' + Object.keys(all.assignments || {}).length,
        'notes: ' + Object.keys(all).filter((k) => k.indexOf('note:') === 0).length,
        '',
        'recent internal warnings (' + (all.diag || []).length + '):'
      ].concat(all.diag || []);
      navigator.clipboard.writeText(lines.join('\n')).then(
        () => status('Diagnostics copied — paste into a GitHub issue.'),
        () => status('Could not access the clipboard.', true)
      );
    });
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let p;
      try { p = JSON.parse(r.result); } catch (err) { status('Not a valid JSON file.', true); return; }
      if (!p || p.app !== 'shelf' || !p.data || typeof p.data !== 'object') {
        status('Not a Shelf backup file.', true);
        return;
      }
      const inc = p.data;
      chrome.storage.local.get(null, (cur) => {
        cur = cur || {};
        const out = {};
        // sections travel as one object; the newer sectionsRev wins
        const curRev = cur.sectionsRev || 0;
        const incRev = inc.sectionsRev || 0;
        const curHas = cur.sections && Object.keys(cur.sections).length;
        if (inc.sections && (!curHas || incRev > curRev)) {
          out.sections = inc.sections;
          out.sectionsRev = incRev || Date.now();
        }
        // assignments and notes merge per item; newer timestamp wins
        const merged = Object.assign({}, cur.assignments || {});
        for (const k of Object.keys(inc.assignments || {})) {
          const v = inc.assignments[k];
          if (!merged[k] || (v.t || 0) > (merged[k].t || 0)) merged[k] = v;
        }
        out.assignments = merged;
        for (const k of Object.keys(inc)) {
          if (k.indexOf('note:') !== 0) continue;
          if (!cur[k] || (inc[k].t || 0) > (cur[k].t || 0)) out[k] = inc[k];
        }
        if (inc.hintDone || cur.hintDone) out.hintDone = true;
        chrome.storage.local.set(out, () => {
          if (chrome.runtime.lastError) {
            status('Import failed: ' + chrome.runtime.lastError.message, true);
            return;
          }
          try {
            chrome.storage.sync.set(out, () => { void chrome.runtime.lastError; });
          } catch (err) { /* mirror only */ }
          status('Imported. Open Gmail tabs update automatically.');
        });
      });
    };
    r.readAsText(f);
  });
})();

// ------------------------------------------------------------- labs ----
// Hidden staging area for experimental features: open options.html?labs=1
// (chrome-extension://<id>/options.html?labs=1) to reveal. Flags live in
// storage.local `labs`; content.js picks changes up live via onChanged.
(() => {
  'use strict';
  if (location.search.indexOf('labs=1') === -1) return;
  const box = document.getElementById('labs');
  const list = document.getElementById('labsList');
  const report = document.getElementById('labsReport');
  if (!box || !list) return;
  box.style.display = 'block';

  const DEFS = [
    { key: 'rules', label: 'Auto-file rules', hint: '⌥-click a section in a thread’s ☰ menu → always file that sender there. Manage rules on the shelf’s ⋮ menu.' },
    { key: 'aging', label: 'Waiting ages', hint: 'Filed threads show how many days they’ve sat (4d+, amber at 8d+).' },
    { key: 'kits', label: 'Section kits', hint: 'One-click starter sets (Eisenhower, Waiting-first) in every “New section” menu.' },
    { key: 'cursor', label: 'j / k / ↑ / ↓ follow your order', hint: 'In a label with shelves, Gmail’s cursor normally walks its own date order, so it appears to jump. This steers Gmail’s real cursor through the order you see instead — one cursor, still Gmail’s, so Enter / e / # / r all keep acting on the row you’re looking at. If the trick ever stops working, Shelf hands the keys straight back to Gmail.' }
  ];

  chrome.storage.local.get('labs', (all) => {
    const labs = (all && all.labs) || {};
    for (const d of DEFS) {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;margin:8px 0';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.style.cssText = 'display:inline;accent-color:#1a73e8;margin-top:2px';
      cb.checked = !!labs[d.key];
      cb.addEventListener('change', () => {
        chrome.storage.local.get('labs', (cur) => {
          const l2 = (cur && cur.labs) || {};
          l2[d.key] = cb.checked;
          chrome.storage.local.set({ labs: l2 });
        });
      });
      const t = document.createElement('span');
      t.innerHTML = '<b>' + d.label + '</b><br><span style="color:#5f6368">' + d.hint + '</span>';
      row.appendChild(cb);
      row.appendChild(t);
      list.appendChild(row);
    }
  });

  // read-only shelf report, computed locally from storage
  chrome.storage.local.get(null, (all) => {
    if (!report || !all) return;
    const sections = all.sections || {};
    let shelves = 0;
    for (const k of Object.keys(sections)) shelves += (sections[k].list || []).length;
    const asg = all.assignments || {};
    const tids = Object.keys(asg);
    let oldest = null;
    for (const k of tids) {
      const t = asg[k] && asg[k].t;
      if (t && (!oldest || t < oldest)) oldest = t;
    }
    const notes = Object.keys(all).filter((k) => k.indexOf('note:') === 0).length;
    report.innerHTML =
      '<b>Shelf report</b><br>' +
      Object.keys(sections).length + ' label(s) with shelves · ' + shelves + ' shelves · ' +
      tids.length + ' filed threads · ' + notes + ' notes · ' +
      ((all.rules || []).length) + ' auto-file rules' +
      (oldest ? '<br>Oldest filed thread: ' + Math.floor((Date.now() - oldest) / 86400000) + ' days ago' : '');
  });
})();
