/* Actualizaciones de las apps: comprueba version.json de la app, avisa cuando hay
   una versión nueva con un botón «Actualizar» y ofrece una tarjeta para los ajustes. */
(function () {
  'use strict';
  const me = document.currentScript;
  const APP = (me && me.dataset.app) || 'app';
  const KEY = 'app-version-' + APP;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let running = null; // versión cargada en pantalla
  let latest = null;  // última versión publicada
  let checking = false;
  let first = navigator.onLine !== false;

  try { running = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { running = null; }

  const css = document.createElement('style');
  css.textContent = `
    .upd-banner { position: fixed; left: 10px; right: 10px; top: calc(10px + env(safe-area-inset-top, 0px)); z-index: 9999; max-width: 520px; margin: 0 auto;
      display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 16px; background: #1f3644; color: #eef3f7;
      border: 1px solid var(--accent, #5ad1ff); box-shadow: 0 10px 30px #0009; font: 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    .upd-banner b { display: block; font-size: 15px; }
    .upd-banner small { opacity: .8; }
    .upd-btn { border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 700; cursor: pointer; font: inherit; font-weight: 700; }
    .upd-go { background: var(--accent, #5ad1ff); color: #05212c; white-space: nowrap; }
    .upd-x { background: transparent; color: inherit; opacity: .7; padding: 8px; }
    .upd-card .upd-notes { margin: 8px 0 0; padding-left: 18px; font-size: 13px; opacity: .85; }
    .upd-card .upd-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .upd-card .upd-row .upd-btn { flex: 1; }
    .upd-card .upd-sec { background: transparent; border: 1px solid currentColor; color: inherit; opacity: .85; }
    .upd-card .upd-msg { font-size: 13px; margin-top: 8px; opacity: .85; }`;
  document.head.appendChild(css);

  async function fetchLatest() {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('sin version.json');
    return r.json();
  }

  const newer = () => latest && running && latest.version !== running.version;

  function showBanner() {
    if (!newer() || document.getElementById('upd-banner') || sessionStorage.getItem('upd-later-' + APP) === latest.version) return;
    const b = document.createElement('div');
    b.id = 'upd-banner';
    b.className = 'upd-banner';
    b.setAttribute('role', 'status');
    b.innerHTML = `<div style="flex:1;min-width:0"><b>🆕 Nueva versión ${esc(latest.version)}</b><small>${esc((latest.notes || [])[0] || 'Mejoras y correcciones')}</small></div>
      <button class="upd-btn upd-go" data-upd="apply">Actualizar</button><button class="upd-btn upd-x" data-upd="later" aria-label="Más tarde">✕</button>`;
    document.body.appendChild(b);
  }

  async function check(manual) {
    if (checking) return;
    checking = true;
    try {
      latest = await fetchLatest();
      // La primera comprobación con conexión corresponde a lo que se acaba de cargar (la red tiene prioridad)
      if (!running || first) { running = latest; localStorage.setItem(KEY, JSON.stringify(running)); }
      first = false;
      if (newer()) { showBanner(); if (!manual) msg = ''; }
      if (manual) setMsg(newer() ? `Hay una versión nueva: ${latest.version}` : `✓ Ya tienes la última versión (${running.version})`);
    } catch (e) {
      first = false;
      if (manual) setMsg('No se pudo comprobar: revisa tu conexión a internet.');
    } finally { checking = false; refreshCard(); }
  }

  async function apply() {
    const b = document.getElementById('upd-banner');
    if (b) b.querySelector('b').textContent = 'Actualizando…';
    try {
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.startsWith(APP)).map(k => caches.delete(k))); }
      if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update().catch(() => {}); }
    } catch (e) { /* se recarga igualmente */ }
    if (latest) localStorage.setItem(KEY, JSON.stringify(latest));
    location.reload();
  }

  let msg = '';
  function setMsg(m) { msg = m; refreshCard(); }
  function cardInner() {
    const v = running || latest;
    const notes = (v && v.notes) || [];
    return `<div><b>Versión ${esc(v ? v.version : '—')}</b>${v && v.date ? ` <span style="opacity:.7;font-size:13px">· ${esc(v.date)}</span>` : ''}</div>
      ${notes.length ? `<ul class="upd-notes">${notes.slice(0, 4).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="upd-row">${newer() ? `<button class="upd-btn upd-go" data-upd="apply">🆕 Actualizar a ${esc(latest.version)}</button>` : ''}<button class="upd-btn upd-sec" data-upd="check">🔄 Buscar actualizaciones</button></div>
      ${msg ? `<div class="upd-msg">${esc(msg)}</div>` : ''}`;
  }
  function refreshCard() {
    document.querySelectorAll('.upd-card').forEach(c => { c.innerHTML = cardInner(); });
    document.querySelectorAll('[data-upd-ver]').forEach(el => { el.textContent = (running || latest || {}).version || '1'; });
  }
  // Para incrustar en los ajustes de cada app (usa la clase de tarjeta de la propia app)
  const cardHTML = (cls = 'card') => `<div class="${cls} upd-card">${cardInner()}</div>`;

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-upd]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = b.dataset.upd;
    if (a === 'apply') apply();
    else if (a === 'check') { setMsg('Comprobando…'); check(true); }
    else if (a === 'later') { if (latest) sessionStorage.setItem('upd-later-' + APP, latest.version); b.closest('.upd-banner').remove(); }
  }, true);

  // Comprueba al abrir, al volver a la app y cada 30 minutos
  window.addEventListener('load', () => setTimeout(() => check(false), 1500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  setInterval(() => { if (!document.hidden) check(false); }, 30 * 60 * 1000);

  window.APPUPDATE = { check, apply, cardHTML, get version() { return running && running.version; } };
})();
