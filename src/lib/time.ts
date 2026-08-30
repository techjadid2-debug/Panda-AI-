const OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent, yil bo‘yi UTC+5
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const pad = (value: number) => String(value).padStart(2, "0");
// Intl ishlatilmaydi: Node va brauzer ICU’si uz-UZ ni har xil formatlaydi va bu gidratatsiya xatosiga olib keladi.
const local = (date: Date) => new Date(date.getTime() + OFFSET_MS);

export function tashkentDate(reference: Date = new Date()) {
  const now = local(reference);
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

function formatTime(iso: string) {
  const at = local(new Date(iso));
  return `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

export function formatDateTime(iso: string) {
  const at = local(new Date(iso));
  return `${at.getUTCDate()}-${MONTHS[at.getUTCMonth()]}, ${formatTime(iso)}`;
}

export function formatDue(iso: string, reference: Date = new Date()) {
  const day = tashkentDate(new Date(iso));
  if (day === tashkentDate(reference)) return `Bugun, ${formatTime(iso)}`;
  if (day === tashkentDate(new Date(reference.getTime() + 86_400_000))) return `Ertaga, ${formatTime(iso)}`;
  return formatDateTime(iso);
}

export function isOverdue(iso: string, reference: Date = new Date()) { return new Date(iso).getTime() < reference.getTime(); }

/** Hozirdan `hours` soat keyin, to‘liq soatga yaxlitlangan muddat. */
export function dueInHours(hours: number, reference: Date = new Date()) {
  const due = new Date(reference.getTime() + Math.max(1, hours) * 3_600_000);
  due.setUTCSeconds(0, 0);
  due.setUTCMinutes(0);
  return due.toISOString();
}

/** `YYYY-MM-DD` (brif sanasi) → "24-avgust". Vaqt qismi yo‘q, shuning uchun zona hisobi kerak emas. */
export function formatDay(briefDate: string) {
  const [, month, day] = briefDate.split("-");
  return `${Number(day)}-${MONTHS[Number(month) - 1] ?? month}`;
}
