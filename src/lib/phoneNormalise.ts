/**
 * Normalises UK phone numbers so "07123 456789", "+447123456789" and
 * "0044 7123 456789" all compare as the same number.
 */
export function normalisePhone(phone?: string | null): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^0-9+]/g, "");
  if (!p) return null;
  if (p.startsWith("+440")) p = "+44" + p.slice(4);
  if (p.startsWith("0044")) p = "+44" + p.slice(4);
  if (/^44/.test(p)) p = "+" + p;
  if (p.startsWith("0")) p = "+44" + p.slice(1);
  if (/^7[0-9]{9}$/.test(p)) p = "+44" + p;
  return p;
}
