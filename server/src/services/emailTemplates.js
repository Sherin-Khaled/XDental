function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanLine(value, fallback = "Not provided") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

const TEMPLATE_META = {
  CONTACT: { title: "New contact message", label: "Contact message" },
  NEWSLETTER: { title: "New newsletter subscription", label: "Newsletter subscription" },
  QUOTE: { title: "New quote request", label: "Quote request" },
  PRODUCT_REQUEST: { title: "New product request", label: "Product request" },
  MACHINE_INQUIRY: { title: "New machine inquiry", label: "Machine inquiry" },
  SUPPORT: { title: "New support message", label: "Support message" },
};

function payloadRows(payload) {
  return [
    ["Reference", payload.reference],
    ["Customer", payload.name],
    ["Email", payload.email],
    ["Phone", payload.phone],
    ["Subject", payload.subject],
    ["Product", payload.productName],
    ["Quantity", payload.quantity],
    ["Message", payload.message],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
}

export function buildSubmissionEmail({ category, payload = {}, appBaseUrl = "" }) {
  const meta = TEMPLATE_META[category];
  if (!meta) throw new Error(`Unsupported email category: ${category}`);

  const reference = cleanLine(payload.reference, "");
  const subject = reference ? `${meta.title} — ${reference}` : meta.title;
  const rows = payloadRows(payload);
  const dashboardUrl = payload.adminPath && appBaseUrl
    ? `${appBaseUrl}${String(payload.adminPath).startsWith("/") ? "" : "/"}${payload.adminPath}`
    : "";

  const textLines = [
    "X Dental Store",
    meta.label,
    "",
    ...rows.map(([label, value]) => `${label}: ${cleanLine(value)}`),
    ...(dashboardUrl ? ["", `Open in dashboard: ${dashboardUrl}`] : []),
  ];

  const htmlRows = rows
    .map(([label, value]) => `
      <tr>
        <th style="padding:10px 12px;text-align:left;vertical-align:top;color:#705A16;border-bottom:1px solid #F0E3B8;width:140px">${escapeHtml(label)}</th>
        <td style="padding:10px 12px;color:#242424;border-bottom:1px solid #F0E3B8;white-space:pre-wrap">${escapeHtml(cleanLine(value))}</td>
      </tr>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#F7F5EF;font-family:Arial,sans-serif;color:#242424">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px">
      <div style="background:#11100D;color:#F9DC5C;border-radius:18px 18px 0 0;padding:22px 26px">
        <div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">X Dental Store</div>
        <h1 style="margin:10px 0 0;font-size:24px;color:#FFFFFF">${escapeHtml(meta.label)}</h1>
      </div>
      <div style="background:#FFFFFF;border:1px solid #E8D9A5;border-top:0;border-radius:0 0 18px 18px;padding:22px">
        <table role="presentation" style="width:100%;border-collapse:collapse">${htmlRows}</table>
        ${dashboardUrl ? `<p style="margin:22px 0 0"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#F9DC5C;color:#11100D;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px">Open dashboard record</a></p>` : ""}
      </div>
    </div>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

