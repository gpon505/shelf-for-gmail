// Shelf — backup (export/import) page. Reads/writes chrome.storage.local
// (the source of truth) and mirrors imports to sync best-effort.
(() => {
  'use strict';

  const KNOWN = (k) =>
    k === 'sections' || k === 'sectionsRev' || k === 'assignments' ||
    k === 'hintDone' || k.indexOf('note:') === 0;

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
