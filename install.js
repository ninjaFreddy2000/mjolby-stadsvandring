// ── install.js — "Installera som app"-guiden ─────────────────────────────────
// Låg tidigare i admin.js, appens tyngsta modul. Guiden är öppen för ALLA
// användare och fick därför inte tvinga fram en nedladdning av admin-koden.
// Fristående: inga beroenden utom språkvalet den får via initInstall().

let ctx = null;
export function initInstall(context) { ctx = context; }
const en = () => ctx && ctx.lang === 'en';

export function openInstallGuide() {
  const overlay = document.querySelector('#install');
  const card = document.querySelector('#install-card');
  const close = () => { overlay.setAttribute('aria-hidden', 'true'); if (ctx && ctx.restoreFocus) ctx.restoreFocus(); };
  overlay.setAttribute('aria-hidden', 'false');
  if (ctx && ctx.markFocus) ctx.markFocus();

  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/(macintosh)/i.test(ua) && 'ontouchend' in document);
  const isAndroid = /android/i.test(ua);
  const installed = matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const platform = installed ? 'done' : isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const D = {
    sv: {
      title: '📲 Installera Stadsvandring.io', close: 'Stäng',
      lead: 'Spara appen på hemskärmen så öppnas den i helskärm, laddar snabbare och fungerar även offline.',
      done: '✓ Appen är redan installerad — du kör den som en app just nu.',
      ios_h: 'iPhone / iPad (Safari)', ios: ['Tryck på <b>Dela</b>-knappen (fyrkanten med pilen uppåt) i verktygsfältet.', 'Bläddra ner och välj <b>Lägg till på hemskärmen</b>.', 'Tryck <b>Lägg till</b> uppe till höger. Ikonen hamnar på hemskärmen.'],
      and_h: 'Android (Chrome)', and: ['Tryck på <b>⋮</b>-menyn uppe till höger.', 'Välj <b>Installera app</b> (eller <b>Lägg till på startskärmen</b>).', 'Bekräfta med <b>Installera</b>.'],
      desk_h: 'Dator (Chrome / Edge)', desk: ['Klicka på <b>installationsikonen</b> (⊕ eller en skärm-ikon) längst till höger i adressfältet.', 'Eller öppna menyn <b>⋮</b> → <b>Installera Stadsvandring.io…</b>', 'Klicka <b>Installera</b>. Appen får ett eget fönster och en ikon.'],
      note: 'Tips: ser du ingen installationsknapp? Ladda om sidan en gång, eller använd menyn enligt stegen ovan.',
      yours: 'Din enhet',
    },
    en: {
      title: '📲 Install Stadsvandring.io', close: 'Close',
      lead: 'Add the app to your home screen for full-screen, faster loading and offline use.',
      done: '✓ The app is already installed — you’re running it as an app right now.',
      ios_h: 'iPhone / iPad (Safari)', ios: ['Tap the <b>Share</b> button (square with an up arrow) in the toolbar.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b> in the top right. The icon lands on your home screen.'],
      and_h: 'Android (Chrome)', and: ['Tap the <b>⋮</b> menu in the top right.', 'Choose <b>Install app</b> (or <b>Add to Home screen</b>).', 'Confirm with <b>Install</b>.'],
      desk_h: 'Desktop (Chrome / Edge)', desk: ['Click the <b>install icon</b> (⊕ or a monitor icon) at the right of the address bar.', 'Or open the <b>⋮</b> menu → <b>Install Stadsvandring.io…</b>', 'Click <b>Install</b>. The app gets its own window and an icon.'],
      note: 'Tip: no install button? Reload the page once, or use the menu steps above.',
      yours: 'Your device',
    },
  };
  const d = D[en() ? 'en' : 'sv'];
  const block = (key, head, steps) => `<div class="ig-block${platform === key ? ' ig-here' : ''}">
      <h4>${head}${platform === key ? ` <span class="ig-badge">${d.yours}</span>` : ''}</h4>
      <ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;

  card.innerHTML = `
    <button class="fb-x" id="ig-x" aria-label="${d.close}">&times;</button>
    <h3>${d.title}</h3>
    <p class="fb-sub">${d.lead}</p>
    ${installed ? `<div class="ig-done">${d.done}</div>` : ''}
    ${block('ios', d.ios_h, d.ios)}
    ${block('android', d.and_h, d.and)}
    ${block('desktop', d.desk_h, d.desk)}
    <p class="fb-sub" style="margin-top:12px">${d.note}</p>`;
  card.querySelector('#ig-x').onclick = close;
  setTimeout(() => { const x = card.querySelector('#ig-x'); if (x) x.focus(); }, 30);
}
