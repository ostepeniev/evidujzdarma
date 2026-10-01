import { SITE, SITE_URL } from "./site";
import { TIMELINE } from "@/content/facts";

export type EmailTemplate = "prereg-confirm" | "dis-launch" | "app-ready" | "login-link" | "receipt" | "notice";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl?: string;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string, footerHtml = ""): string {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f7f4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#14211c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #dde4df;border-radius:16px" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 8px"><strong style="font-size:18px">Eviduj<span style="color:#0b7a57">Zdarma</span></strong></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.6">${bodyHtml}</td></tr>
</table>
<p style="max-width:560px;font-size:12px;color:#66756e;line-height:1.5;margin:16px auto 0">
${esc(SITE.independenceNotice)} ${footerHtml}</p>
</td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#0b7a57;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;
}

function unsubscribe(token: unknown): { url: string; html: string; text: string } {
  const url = `${SITE_URL}/api/odhlasit?token=${encodeURIComponent(String(token))}`;
  return {
    url,
    html: `<a href="${esc(url)}" style="color:#66756e">Odhlásit odběr</a>.`,
    text: `Odhlásit odběr: ${url}`,
  };
}

interface PlanStep {
  date: string;
  text: string;
}

export function renderEmail(template: EmailTemplate, p: Record<string, unknown>): RenderedEmail {
  switch (template) {
    case "prereg-confirm": {
      const confirmUrl = `${SITE_URL}/registrace/potvrzeni?token=${encodeURIComponent(String(p.confirmToken))}`;
      const referralUrl = `${SITE_URL}/?ref=${encodeURIComponent(String(p.referralCode))}`;
      const plan = (p.plan as PlanStep[] | undefined) ?? TIMELINE.map((t) => ({ date: t.dateLabel, text: t.action }));
      const u = unsubscribe(p.unsubscribeToken);
      const company = p.companyName ? ` pro ${esc(p.companyName)}` : "";
      return {
        subject: "Váš EET plán – potvrďte prosím e-mail",
        unsubscribeUrl: u.url,
        text: [
          "Dobrý den,",
          "",
          `děkujeme za předregistraci do EvidujZdarma. Potvrďte prosím e-mail: ${confirmUrl}`,
          "",
          `Váš EET plán${p.companyName ? ` pro ${p.companyName}` : ""}:`,
          ...plan.map((s) => `• ${s.date}: ${s.text}`),
          "",
          `Pozvěte kolegu a oba získáte Premium na 3 měsíce zdarma: ${referralUrl}`,
          "",
          "Tým EvidujZdarma",
          "",
          SITE.independenceNotice,
          u.text,
        ].join("\n"),
        html: layout(
          "Váš EET plán",
          `<p>Dobrý den,</p><p>děkujeme za předregistraci. Jedním kliknutím potvrďte e-mail – pošleme vám návody a včasný přístup k pokladně.</p>
${button(confirmUrl, "Potvrdit e-mail")}
<h2 style="font-size:18px;margin:28px 0 8px">Váš EET plán${company}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${plan
            .map(
              (s) =>
                `<tr><td style="padding:6px 12px 6px 0;white-space:nowrap;vertical-align:top;font-weight:600">${esc(s.date)}</td><td style="padding:6px 0">${esc(s.text)}</td></tr>`,
            )
            .join("")}</table>
<p style="margin-top:24px;padding:14px;background:#fff4cc;border-radius:10px">Pozvěte kolegu a <strong>oba získáte Premium na 3 měsíce zdarma</strong>:<br><a href="${esc(referralUrl)}">${esc(referralUrl)}</a></p>`,
          u.html,
        ),
      };
    }
    case "dis-launch": {
      const u = unsubscribe(p.unsubscribeToken);
      const url = `${SITE_URL}/navody/jak-aktivovat-dis-a-certifikat`;
      return {
        subject: "DIS+ je spuštěné – tady je návod krok za krokem",
        unsubscribeUrl: u.url,
        text: `Dobrý den,\n\nFinanční správa spustila přípravu pro EET 2.0 v DIS+. Připravili jsme návod se snímky obrazovky: ${url}\n\nTým EvidujZdarma\n\n${u.text}`,
        html: layout(
          "DIS+ je spuštěné",
          `<p>Dobrý den,</p><p>Finanční správa spustila přípravu pro EET 2.0 v DIS+. Připravili jsme návod se snímky obrazovky – aktivace a stažení certifikátu zabere pár minut.</p>${button(url, "Otevřít návod")}`,
          u.html,
        ),
      };
    }
    case "app-ready": {
      const u = unsubscribe(p.unsubscribeToken);
      const url = `${SITE_URL}/pokladna`;
      return {
        subject: "Pokladna EvidujZdarma je připravena",
        unsubscribeUrl: u.url,
        text: `Dobrý den,\n\npokladna je připravena. Váš včasný přístup: ${url}\n\nTým EvidujZdarma\n\n${u.text}`,
        html: layout(
          "Pokladna je připravena",
          `<p>Dobrý den,</p><p>pokladna EvidujZdarma je připravena. Nastavení zabere asi 15 minut – průvodce vás provede krok za krokem.</p>${button(url, "Spustit pokladnu")}`,
          u.html,
        ),
      };
    }
    case "login-link": {
      const url = String(p.url);
      return {
        subject: "Přihlášení do EvidujZdarma",
        text: `Pro přihlášení otevřete odkaz (platí 15 minut):\n${url}\n\nPokud jste o přihlášení nežádali, e-mail ignorujte.`,
        html: layout(
          "Přihlášení",
          `<p>Pro přihlášení klikněte na tlačítko. Odkaz platí 15 minut a lze ho použít jen jednou.</p>${button(url, "Přihlásit se")}<p style="font-size:14px;color:#66756e">Pokud jste o přihlášení nežádali, e-mail ignorujte.</p>`,
        ),
      };
    }
    case "notice": {
      const url = p.url ? String(p.url) : null;
      return {
        subject: String(p.subject),
        text: `${p.text}${url ? `\n\n${url}` : ""}\n\nTým EvidujZdarma`,
        html: layout(String(p.subject), `<p>${esc(p.text).replace(/\n/g, "<br>")}</p>${url ? button(url, String(p.buttonLabel ?? "Otevřít")) : ""}`),
      };
    }
    case "receipt": {
      const url = String(p.url);
      return {
        subject: `Účtenka ${esc(p.merchant)} – ${esc(p.total)}`,
        text: `${p.receiptText}\n\nOnline: ${url}`,
        html: layout(
          "Účtenka",
          `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.45;background:#f4f7f4;padding:16px;border-radius:10px;overflow:auto">${esc(p.receiptText)}</pre>${button(url, "Zobrazit účtenku online")}`,
        ),
      };
    }
  }
}
