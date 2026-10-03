// Renders EvidujZdarma social assets from HTML with headless Chromium.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./out/', import.meta.url).pathname;
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
.row{display:flex;align-items:center;gap:18px;padding:16px 22px;border-top:1px solid #e6ece9}
.row:first-child{border-top:0}
.date{font-weight:800;color:#075f44;min-width:150px;font-variant-numeric:tabular-nums}
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
  // Profile picture (FB, LinkedIn, group): icon centred, safe for circle crop
  'profil-1080.png': [1080, 1080, `<body style="background:#fff;display:grid;place-items:center">${ICON(620)}</body>`],
  'linkedin-logo-400.png': [400, 400, `<body style="background:#fff;display:grid;place-items:center">${ICON(260)}</body>`],

  // Facebook page cover 1640x624; content inside central ~1100 px (mobile crop)
  'fb-stranka-cover-1640x624.png': [1640, 624, `
<body style="position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,#f5f7f6 0,#f5f7f6 55%,#eaf7f1 55%,#eaf7f1 100%)"></div>
  <div style="position:absolute;left:270px;right:270px;top:0;bottom:0;display:flex;align-items:center;gap:56px">
    <div style="flex:1.05">
      <div class="brand" style="font-size:34px">${ICON(46)}<span>Eviduj<b>Zdarma</b></span></div>
      <h1 style="font-size:62px;line-height:1.04;letter-spacing:-.03em;font-weight:800;margin:26px 0 16px">EET 2.0 zdarma.<br>I bez signálu.</h1>
      <p style="font-size:24px;line-height:1.4;color:#33433d">Bezplatná pokladna, termíny se zdroji<br>a návody krok za krokem.</p>
    </div>
    <div style="flex:1">${timeline()}
      <p class="foot" style="font-size:17px;margin-top:14px">Zdroj: eet.gov.cz · evidujzdarma.cz</p>
    </div>
  </div>
  <div class="foot" style="position:absolute;left:270px;bottom:22px;font-size:16px">Nezávislá služba, není provozována Finanční správou.</div>
</body>`],

  // Facebook group cover 1640x856
  'fb-skupina-cover-1640x856.png': [1640, 856, `
<body style="position:relative;overflow:hidden;background:#f5f7f6">
  <div class="stripe"></div>
  <div style="position:absolute;left:230px;right:230px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center">
    <div class="label" style="font-size:22px">Skupina pro podnikatele</div>
    <h1 style="font-size:78px;line-height:1.02;letter-spacing:-.03em;font-weight:800;margin:18px 0 22px">EET 2.0 v praxi:<br>ptejte se, pomáháme si</h1>
    <div style="display:flex;gap:28px;font-size:26px;color:#33433d;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:12px">${CHECK}DIS+ a certifikát</span>
      <span style="display:flex;align-items:center;gap:12px">${CHECK}Evidenční jednotky</span>
      <span style="display:flex;align-items:center;gap:12px">${CHECK}EET OFF pro paušalisty</span>
    </div>
    <div class="brand" style="font-size:28px;margin-top:56px">${ICON(40)}<span>Eviduj<b>Zdarma</b></span><span style="font-weight:500;color:#4a5a54;font-size:20px;margin-left:14px">Nezávislá služba, není provozována Finanční správou.</span></div>
  </div>
</body>`],

  // LinkedIn cover 1128x191
  'linkedin-cover-1128x191.png': [1128, 191, `
<body style="position:relative;overflow:hidden;background:#f5f7f6">
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 56px 0 300px">
    <div>
      <div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Bezplatná pokladna pro EET 2.0</div>
      <div style="font-size:17px;color:#33433d;margin-top:6px">Evidence tržeb povinně od 1. 1. 2027 · i bez signálu · evidujzdarma.cz</div>
    </div>
    ${ICON(84)}
  </div>
</body>`],

  // First post image 1200x1200
  'post-uvod-1200.png': [1200, 1200, `
<body style="position:relative;overflow:hidden;background:#f5f7f6">
  <div class="stripe" style="width:18px"></div>
  <div style="position:absolute;left:110px;right:100px;top:100px;bottom:90px;display:flex;flex-direction:column">
    <div class="brand" style="font-size:36px">${ICON(54)}<span>Eviduj<b>Zdarma</b></span></div>
    <div class="label" style="font-size:24px;margin-top:70px">EET 2.0</div>
    <h1 style="font-size:84px;line-height:1.02;letter-spacing:-.035em;font-weight:800;margin:14px 0 26px">Od 1. 1. 2027<br>se znovu evidují tržby.</h1>
    <p style="font-size:32px;line-height:1.35;color:#33433d">Nově i platby kartou a QR kódem.<br>Bez výjimky pro leden.</p>
    <div style="margin-top:auto">${timeline(true)}
      <p class="foot" style="font-size:20px;margin-top:16px">Zdroj: eet.gov.cz · Nezávislá služba, není provozována Finanční správou.</p>
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
