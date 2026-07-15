// Email delivery via Resend's REST API (plain fetch, no SDK — same pattern as
// the Gemini scorer). Every path is a graceful no-op when RESEND_API_KEY is
// unset, so the app works fully without email configured.

const FROM = process.env.EMAIL_FROM || "ChurnGuard <onboarding@resend.dev>";

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function appUrl(path = ""): string {
  const base =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return `${base}${path}`;
}

// Returns true if the email was accepted by Resend. Logs and returns false on
// any failure — email must never break the calling flow.
export async function sendEmail(msg: {
  to: string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!emailEnabled() || msg.to.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      console.error("Resend send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send failed:", err);
    return false;
  }
}

const wrapper = (inner: string) => `
  <div style="font-family:system-ui,sans-serif;background:#0b0f17;color:#e6eaf2;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#121826;border:1px solid #253049;border-radius:16px;padding:24px">
      <p style="margin:0 0 16px;font-weight:600;font-size:16px">⚡ ChurnGuard</p>
      ${inner}
    </div>
  </div>`;

export function alertEmailHtml(
  rule: { name: string },
  customer: { id: string; name: string; mrr: number },
  detail: string,
): string {
  return wrapper(`
    <p style="margin:0 0 8px;font-size:14px;color:#93a0b8">Alert rule fired: <strong style="color:#e6eaf2">${rule.name}</strong></p>
    <p style="margin:0 0 16px;font-size:14px">${detail}</p>
    <a href="${appUrl(`/customers/${customer.id}`)}"
       style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px;font-size:14px">
      View ${customer.name} ($${Math.round(customer.mrr)}/mo)
    </a>`);
}

export interface WeeklyDigestData {
  windowStart: Date;
  windowEnd: Date;
  newHighRisk: Array<{ id: string; name: string; score: number; mrr: number }>;
  improved: number;
  worsened: number;
  mrrAtRisk: number;
  openTasksOverdue: number;
  alertsFired: number;
}

export function digestEmailHtml(d: WeeklyDigestData): string {
  const rows = d.newHighRisk
    .map(
      (c) => `
      <tr>
        <td style="padding:6px 0;font-size:14px">
          <a href="${appUrl(`/customers/${c.id}`)}" style="color:#e6eaf2;text-decoration:none">${c.name}</a>
        </td>
        <td style="padding:6px 0;font-size:14px;color:#ef4444;text-align:right">${c.score}/100</td>
        <td style="padding:6px 0;font-size:14px;color:#93a0b8;text-align:right">$${Math.round(c.mrr)}/mo</td>
      </tr>`,
    )
    .join("");

  return wrapper(`
    <p style="margin:0 0 16px;font-size:15px;font-weight:600">Your weekly churn digest</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr>
        <td style="font-size:13px;color:#93a0b8;padding:4px 0">MRR at risk (HIGH band)</td>
        <td style="font-size:13px;text-align:right">$${Math.round(d.mrrAtRisk)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#93a0b8;padding:4px 0">Risk improved / worsened</td>
        <td style="font-size:13px;text-align:right">${d.improved} / ${d.worsened}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#93a0b8;padding:4px 0">Alerts fired this week</td>
        <td style="font-size:13px;text-align:right">${d.alertsFired}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#93a0b8;padding:4px 0">Overdue open interventions</td>
        <td style="font-size:13px;text-align:right">${d.openTasksOverdue}</td>
      </tr>
    </table>
    ${
      d.newHighRisk.length > 0
        ? `<p style="margin:0 0 8px;font-size:14px;font-weight:600">Newly high-risk accounts</p>
           <table style="width:100%;border-collapse:collapse;margin-bottom:16px">${rows}</table>`
        : `<p style="margin:0 0 16px;font-size:14px;color:#22c55e">No accounts moved into the high-risk band this week. 🎉</p>`
    }
    <a href="${appUrl("/dashboard")}"
       style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px;font-size:14px">
      Open dashboard
    </a>`);
}
