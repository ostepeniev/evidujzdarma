// Renders EvidujZdarma social assets from HTML with headless Chromium.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const ICON = (size, bg = '#0b7a57', fg = '#fff') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" rx="9" fill="${bg}"/>
  <path d="M10 7.5h12a1.5 1.5 0 0 1 1.5 1.5v15.6l-2.25-1.4-2.25 1.4-2.25-1.4-2.25 1.4-2.25-1.4-2.25 1.4V9A1.5 1.5 0 0 1 10 7.5Z" fill="${fg}"/>
  <path d="m12.6 15.6 2.4 2.4 4.6-5" fill="none" stroke="${bg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%}
body{font-family:Inter,"Inter Display",system-ui,sans-serif;color:#0f1f19;background:#f5f7f6;-webkit-font-smoothing:antialiased}
.brand{display:flex;align-items:center;gap:.45em;font-weight:800;letter-spacing:-.02em}
.brand b{color:#0b7a57;font-weight:800}
.label{font-size:.8em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#075f44}
.card{background:#fff;border:1px solid #d9e3de;border-radius:18px}
.row{display:flex;align-items:center;gap:18px;padding:16px 22px;white-space:nowrap;border-top:1px solid #e6ece9}
.row:first-child{border-top:0}
.date{font-weight:800;color:#075f44;min-width:7.2em;white-space:nowrap;font-variant-numeric:tabular-nums}
.check{width:26px;height:26px;border-radius:50%;background:#eaf7f1;display:grid;place-items:center;flex:0 0 auto}
.check svg{width:16px;height:16px}
.foot{color:#4a5a54}
.stripe{position:absolute;left:0;top:0;bottom:0;width:14px;background:#0b7a57}
`;
const CHECK = `<span class="check"><svg viewBox="0 0 16 16"><path d="m3.5 8.3 2.8 2.8 6-6.3" fill="none" stroke="#0b7a57" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

const timeline = (big = false) => `
<div class="card" style="font-size:${big ? 26 : 22}px">
  <div class="row"><span class="date">1. 11. 2026</span><span>DIS+ a pokladní certifikát</span></div>
  <div class="row"><span class="date">1. 1. 2027</span><span><strong>Povinnost evidovat tržby</strong></span></div>
  <div class="row"><span class="date">11. 1. 2027</span><span>Poslední den pro EET OFF</span></div>
</div>`;

const pages = {
  // 1423x672 = screenshot of the Chrome viewport at 100 %: upload via screenshot without black bands
  'shot-fb-stranka.png': [1423, 672, `
<body style="position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,#f5f7f6 0,#f5f7f6 55%,#eaf7f1 55%,#eaf7f1 100%)"></div>
  <div style="position:absolute;left:235px;right:235px;top:65px;height:541px;display:flex;align-items:center;gap:48px">
    <div style="flex:1.05">
      <div class="brand" style="font-size:30px">${ICON(40)}<span>Eviduj<b>Zdarma</b></span></div>
      <h1 style="font-size:54px;line-height:1.04;letter-spacing:-.03em;font-weight:800;margin:22px 0 14px">EET 2.0 zdarma.<br>I bez signálu.</h1>
      <p style="font-size:21px;line-height:1.4;color:#33433d">Bezplatná pokladna, termíny se zdroji<br>a návody krok za krokem.</p>
    </div>
    <div style="flex:1.2">${timeline().replace('font-size:22px','font-size:19px').replace(/min-width:150px/g,'')}
      <p class="foot" style="font-size:15px;margin-top:12px">Zdroj: eet.gov.cz · evidujzdarma.cz</p>
    </div>
  </div>
  <div class="foot" style="position:absolute;left:235px;top:${65+541-40}px;font-size:14px">Nezávislá služba, není provozována Finanční správou.</div>
</body>`],
  'shot-fb-skupina.png': [1423, 672, `
<body style="position:relative;overflow:hidden;background:#f5f7f6">
  <div class="stripe" style="left:68px"></div>
  <div style="position:absolute;left:200px;right:160px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center">
    <div class="label" style="font-size:19px">Skupina pro podnikatele</div>
    <h1 style="font-size:66px;line-height:1.02;letter-spacing:-.03em;font-weight:800;margin:16px 0 20px">EET 2.0 v praxi:<br>ptejte se, pomáháme si</h1>
    <div style="display:flex;gap:24px;font-size:22px;color:#33433d;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:10px">${CHECK}DIS+ a certifikát</span>
      <span style="display:flex;align-items:center;gap:10px">${CHECK}Evidenční jednotky</span>
      <span style="display:flex;align-items:center;gap:10px">${CHECK}EET OFF pro paušalisty</span>
    </div>
    <div class="brand" style="font-size:24px;margin-top:44px">${ICON(34)}<span>Eviduj<b>Zdarma</b></span><span style="font-weight:500;color:#4a5a54;font-size:17px;margin-left:12px">Nezávislá služba, není provozována Finanční správou.</span></div>
  </div>
</body>`],
  'shot-linkedin-cover.png': [1423, 672, `
<body style="position:relative;overflow:hidden;background:#f5f7f6">
  <div style="position:absolute;left:0;right:0;top:${(672-241)/2}px;height:241px;display:flex;align-items:center;justify-content:space-between;padding:0 70px 0 380px">
    <div>
      <div style="font-size:38px;font-weight:800;letter-spacing:-.02em">Bezplatná pokladna pro EET 2.0</div>
      <div style="font-size:21px;color:#33433d;margin-top:8px">Evidence tržeb povinně od 1. 1. 2027 · i bez signálu · evidujzdarma.cz</div>
    </div>
    ${ICON(104)}
  </div>
</body>`],
  'shot-post-uvod.png': [1423, 672, `
<body style="position:relative;overflow:hidden;background:#f5f7f6">
  <div class="stripe"></div>
  <div style="position:absolute;left:90px;right:70px;top:0;bottom:0;display:flex;align-items:center;gap:56px">
    <div style="flex:1.1">
      <div class="brand" style="font-size:28px">${ICON(40)}<span>Eviduj<b>Zdarma</b></span></div>
      <div class="label" style="font-size:18px;margin-top:40px">EET 2.0</div>
      <h1 style="font-size:60px;line-height:1.03;letter-spacing:-.035em;font-weight:800;margin:10px 0 18px">Od 1. 1. 2027<br>se znovu evidují tržby.</h1>
      <p style="font-size:24px;line-height:1.35;color:#33433d">Nově i platby kartou a QR kódem.<br>Bez výjimky pro leden.</p>
    </div>
    <div style="flex:1">${timeline()}
      <p class="foot" style="font-size:15px;margin-top:12px">Zdroj: eet.gov.cz · Nezávislá služba, není provozována Finanční správou.</p>
    </div>
  </div>
</body>`],
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }).catch(() => chromium.launch());
for (const [name, [w, h, body]] of Object.entries(pages)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>${body}</html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT + name, type: 'png' });
  await page.close();
  console.log('ok', name);
}
await browser.close();
