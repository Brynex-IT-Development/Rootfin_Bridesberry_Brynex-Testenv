// utils/parseBase64.js
export default function parseBase64(dataUrl) {
  if (!dataUrl) return null;

  // "data:image/png;base64,AAAA…" → ["image/png","AAAA…"]
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid base-64 string");

  const contentType = m[1];              // image/png
  const ext         = contentType.split("/")[1] || "bin";
  const buffer      = Buffer.from(m[2], "base64");

  const safeExt = ext.replace(/[^a-z0-9.+-]/gi, "") || "bin";
  const filename = `receipt-${Date.now()}.${safeExt}`;

  return { filename, contentType, data: buffer };
}
