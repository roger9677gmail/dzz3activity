// Parse a value that came back from MySQL (DATE or DATETIME, with dateStrings:true
// in the connection pool so we always get a string like "2026-05-17" or
// "2026-05-17 14:30:00"). Returns a Date. Safari is strict about the ISO format,
// so we normalize the space separator to "T" before handing to Date.
function parseDbDateLike(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  // Already date-only → append T00:00 so it parses as local midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  // MySQL DATETIME 'YYYY-MM-DD HH:mm:ss' → swap space for T.
  if (/^\d{4}-\d{2}-\d{2}[ T]/.test(s)) return new Date(s.replace(' ', 'T'));
  return new Date(s);
}

// Pull just the time-of-day off a DB DATETIME string. Returns null when the
// value is date-only or 00:00 (so callers can decide whether to render time).
function extractHM(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const hh = m[1], mm = m[2];
  if (hh === '00' && mm === '00') return null;
  return `${hh}:${mm}`;
}

export function formatDate(dateStr) {
  const d = parseDbDateLike(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTime(dateStr) {
  const d = parseDbDateLike(dateStr);
  if (!d) return '';
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// Smart event-date renderer used in cards / detail pages.
//  - Same day, both times midnight  → "2026年5月17日"
//  - Same day, has times             → "2026年5月17日 14:00 ～ 16:00"
//  - Different days, both midnight   → "2026年5月17日 ～ 2026年5月18日"
//  - Different days, has times       → "2026年5月17日 14:00 ～ 2026年5月18日 16:00"
export function formatEventDateRange(start, end) {
  const ds = parseDbDateLike(start);
  const de = parseDbDateLike(end);
  if (!ds) return '';
  const startDate = formatDate(start);
  const startHM = extractHM(start);
  if (!de) return startHM ? `${startDate} ${startHM}` : startDate;

  const sameDay = ds.toDateString() === de.toDateString();
  const endDate = formatDate(end);
  const endHM = extractHM(end);

  if (sameDay) {
    if (!startHM && !endHM) return startDate;
    return `${startDate} ${startHM || '00:00'} ～ ${endHM || ''}`.trim();
  }
  // Different days.
  const left = startHM ? `${startDate} ${startHM}` : startDate;
  const right = endHM ? `${endDate} ${endHM}` : endDate;
  return `${left} ～ ${right}`;
}

// Deadline display: always show date + HH:mm so members know the cut-off time.
// If the deadline has no time component (legacy DATE rows pre-migration that
// were promoted to 00:00:00), we still show 00:00 to make the cut-off explicit.
export function formatDeadline(deadline) {
  const d = parseDbDateLike(deadline);
  if (!d) return '';
  const date = formatDate(deadline);
  const hm = extractHM(deadline);
  return `${date} ${hm || '00:00'}`;
}

// Convert a DB DATE/DATETIME string into the value an <input type="datetime-local">
// expects ("YYYY-MM-DDTHH:mm"). HTML5 datetime-local has no seconds by default.
export function toDateTimeLocalValue(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  return s;
}

export function formatMoney(amount) {
  return `NT$ ${Number(amount).toLocaleString('zh-TW')}`;
}

// Build a Google Maps "search" URL for any free-text place / address. Works
// on both web (opens maps.google.com) and on phones with the Maps app
// installed (the OS picks up the universal link and launches the app).
export function googleMapsUrl(query) {
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isDeadlinePassed(deadline) {
  const d = parseDbDateLike(deadline);
  if (!d) return false;
  return d < new Date();
}

export function daysUntil(dateStr) {
  const d = parseDbDateLike(dateStr);
  if (!d) return 0;
  const diff = d - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusLabel(status) {
  const map = {
    pending: '待確認',
    confirmed: '已確認',
    cancelled: '已取消',
  };
  return map[status] || status;
}

export function getPaymentStatusLabel(status) {
  const map = {
    unpaid: '未繳款',
    paid: '已繳款',
  };
  return map[status] || status;
}

export function getEventStatusLabel(status) {
  const map = {
    active: '報名中',
    closed: '已截止',
    draft: '草稿',
  };
  return map[status] || status;
}

// Parse a JSON string defensively. Returns `fallback` (default []) on any error
// or if input is null/empty. Use anywhere we read JSON columns (names/contents,
// attendance answers, etc.) so a single malformed row doesn't crash the page.
export function safeParseJSON(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
