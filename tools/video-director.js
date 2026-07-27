// In-page "director" for the launch video: drives tools/demo.html like a
// patient human hand — animated cursor, real mouse events (so planks, ghosts,
// rings and popovers are the extension's genuine behavior), in-page captions,
// and the kicker slide. Recorded by tools/record-video.mjs.
// Returns a beat log [{name, t(ms)}] for cutting the GIF.
window.__runDemo = async function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const log = [];
  const mark = (name) => log.push({ name, t: Math.round(performance.now()) });

  // ---------------------------------------------------------- overlays ----
  const style = document.createElement('style');
  style.textContent = [
    '#vd-cursor { position: fixed; z-index: 2147483647; width: 20px; height: 26px;',
    '  pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }',
    '#vd-cap { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);',
    '  background: rgba(32,33,36,.92); color: #fff; font: 500 17px/1.45 -apple-system,',
    '  Roboto, Helvetica, sans-serif; padding: 11px 22px; border-radius: 24px;',
    '  z-index: 2147483646; max-width: 780px; text-align: center; opacity: 0;',
    '  transition: opacity 300ms; box-shadow: 0 4px 16px rgba(0,0,0,.3); white-space: nowrap; }',
    'tr.zA.vd-hov td { background: #f2f6fc; }',
    'tr.zA.vd-hov td.when ul { display: inline-flex !important; gap: 2px;',
    '  list-style: none; margin: 0; padding: 0; vertical-align: middle; }',
    'tr.zA.vd-hov td.when .date { display: none; }',
    '.vd-pulse { position: fixed; z-index: 2147483645; width: 34px; height: 34px;',
    '  border-radius: 50%; background: rgba(26,115,232,.35);',
    '  transform: translate(-50%,-50%) scale(.3); animation: vdp 420ms ease-out forwards;',
    '  pointer-events: none; }',
    '@keyframes vdp { to { transform: translate(-50%,-50%) scale(1.7); opacity: 0; } }',
    '#vd-kick { position: fixed; inset: 0; background: #1f1f1f; z-index: 2147483644;',
    '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
    '  gap: 20px; opacity: 0; transition: opacity 700ms; color: #fff;',
    '  font: 400 30px/1.5 -apple-system, Roboto, Helvetica, sans-serif; text-align: center; }',
    '#vd-kick b { font-weight: 700; font-size: 40px; }',
    '#vd-kick .small { font-size: 17px; color: #9aa0a6; line-height: 1.8; }',
    '#vd-kick .mark { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }',
    '#vd-kick .mark i { display: block; height: 7px; border-radius: 4px; background: #fdd663; }'
  ].join('\n');
  document.head.appendChild(style);

  const cursor = document.createElement('div');
  cursor.id = 'vd-cursor';
  cursor.innerHTML = '<svg viewBox="0 0 20 26"><path d="M2 1 L2 20 L7 15.5 L10.5 24 L13.8 22.6 L10.3 14.4 L17 14 Z" fill="#fff" stroke="#202124" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  document.body.appendChild(cursor);
  let cx = 640;
  let cy = 520;
  const setCur = (x, y) => { cx = x; cy = y; cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; };
  setCur(cx, cy);

  const cap = document.createElement('div');
  cap.id = 'vd-cap';
  document.body.appendChild(cap);
  async function caption(text) {
    cap.style.opacity = 0;
    await sleep(280);
    cap.textContent = text;
    cap.style.opacity = 1;
  }

  let hovRow = null;
  function syncHover(x, y) {
    const el = document.elementFromPoint(x, y);
    const row = el && el.closest ? el.closest('tr.zA') : null;
    if (row !== hovRow) {
      if (hovRow) hovRow.classList.remove('vd-hov');
      hovRow = row;
      if (hovRow) hovRow.classList.add('vd-hov');
    }
  }
  async function move(x, y, ms, dragging) {
    const x0 = cx;
    const y0 = cy;
    const steps = Math.max(8, Math.round((ms || 600) / 16));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const nx = x0 + (x - x0) * e;
      const ny = y0 + (y - y0) * e;
      setCur(nx, ny);
      if (dragging) {
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: nx, clientY: ny, button: 0 }));
      } else {
        syncHover(nx, ny);
      }
      await sleep(16);
    }
  }
  function pulse() {
    const p = document.createElement('div');
    p.className = 'vd-pulse';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 500);
  }
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  async function moveTo(el, ms, dx, dy) {
    const [x, y] = center(el);
    await move(x + (dx || 0), y + (dy || 0), ms);
  }
  async function click(el) {
    pulse();
    const o = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
    el.dispatchEvent(new MouseEvent('mousedown', o));
    await sleep(70);
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    await sleep(140);
  }
  async function dragTo(grabEl, tx, ty, holdMs) {
    await moveTo(grabEl, 700);
    pulse();
    grabEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 }));
    await sleep(90);
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: cx + 6, clientY: cy + 9, button: 0 }));
    await move(tx, ty, 950, true);
    await sleep(holdMs || 550);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 }));
    await sleep(650);
  }
  const rowById = (id) => $$('tr.zA').find((r) => r.querySelector('[data-legacy-thread-id="' + id + '"]'));
  const headerByName = (n) => $$('tr.shelf-header').find((h) => {
    const s = h.querySelector('.shelf-name');
    return s && s.textContent === n;
  });
  async function makeShelf(name) {
    const addB = $('.shelf-add-b');
    await moveTo(addB, 750);
    await click(addB);
    let inp = null;
    for (let i = 0; i < 25 && !inp; i++) { inp = $('.shelf-input'); if (!inp) await sleep(100); }
    for (const ch of name) {
      inp.value += ch;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(52);
    }
    await sleep(260);
    inp.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    await sleep(750);
    return headerByName(name);
  }
  const setCaretEnd = (ed) => {
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  };

  // ================================================== the timeline ====
  mark('start');
  await caption('Gmail labels organize email into folders. Then the folder is just… another pile.');
  await sleep(1100);
  await move(640, 380, 900);
  await move(670, 560, 900);
  await sleep(1500);

  mark('beat2');
  await caption('Make a shelf. Drag threads onto it. That’s the whole learning curve.');
  let tw = await makeShelf('This week');
  await dragTo(rowById('en').children[3], ...center(tw), 550);
  tw = headerByName('This week');
  await dragTo(rowById('cr').children[3], ...center(tw), 420);
  await sleep(500);

  mark('beat3');
  await caption('Stick a note on anything — even a checklist. Red means don’t let it slip.');
  const maria = rowById('m1');
  await moveTo(maria.children[3], 800);
  await sleep(350); // hover reveals the row toolbar
  const noteBtn = maria.querySelector('.shelf-btn-note');
  await moveTo(noteBtn, 550);
  await click(noteBtn);
  let ed = null;
  for (let i = 0; i < 25 && !ed; i++) { ed = $('.shelf-pop-ed'); if (!ed) await sleep(100); }
  ed.focus();
  setCaretEnd(ed);
  for (const ch of 'promised IEP times by Friday') {
    document.execCommand('insertHTML', false, ch === ' ' ? '&nbsp;' : ch);
    await sleep(42);
  }
  await sleep(300);
  const red = $('.shelf-pop .shelf-sw-red');
  await moveTo(red, 550);
  await click(red);
  await sleep(300);
  const cbx = $('.shelf-pop .shelf-fmt-cbx');
  await moveTo(cbx, 500);
  setCaretEnd(ed);
  await click(cbx);
  for (const ch of 'call the office') {
    document.execCommand('insertHTML', false, ch === ' ' ? '&nbsp;' : ch);
    await sleep(42);
  }
  await sleep(350);
  const tick = ed.querySelector('input[type="checkbox"]');
  await moveTo(tick, 500);
  pulse();
  tick.click();
  await sleep(650);
  ed.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }));
  await sleep(500);
  await moveTo(rowById('m1').querySelector('.shelf-chip') || rowById('m1').children[3], 600);
  await sleep(900);

  mark('beat4');
  await caption('Shelves nest. Drag one into another.');
  const pa = await makeShelf('Parents & students');
  await dragTo(rowById('kl').children[3], ...center(pa), 450);
  const pa2 = headerByName('Parents & students');
  const twNow = headerByName('This week');
  const twr = twNow.getBoundingClientRect();
  await dragTo(pa2.querySelector('.shelf-h'), twr.left + twr.width / 2, twr.top + twr.height / 2, 900);
  await sleep(700);

  mark('beat5');
  await caption('New mail on top. Your shelves below. Inbox zero, minus the willpower.');
  const elseHdr = headerByName('Everything else');
  const first = $$('tr.shelf-header')[0];
  const fr = first.getBoundingClientRect();
  await dragTo(elseHdr.querySelector('.shelf-h'), fr.left + fr.width / 2, fr.top + 3, 550);
  await sleep(1400);

  mark('kicker');
  const kick = document.createElement('div');
  kick.id = 'vd-kick';
  kick.innerHTML =
    '<div class="mark"><i style="width:64px"></i><i style="width:64px"></i><i style="width:40px"></i></div>' +
    '<div>Shelf never touches your email.<br><b>It can’t.</b></div>' +
    '<div class="small">No Gmail access. No account. Free.<br>getshelf.email</div>';
  document.body.appendChild(kick);
  cap.style.opacity = 0;
  cursor.style.display = 'none';
  await sleep(60);
  kick.style.opacity = 1;
  await sleep(6000);
  mark('end');
  return log;
};
