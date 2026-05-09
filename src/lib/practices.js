// Helpers for the practice journal feature.

export const PRACTICE_TYPES = ['count', 'duration'];
export const RANKING_PERIOD_DAYS = 90;

export function isValidPracticeType(t) {
  return PRACTICE_TYPES.includes(t);
}

// Format a stored value for display. count → "12 次"; duration (minutes) → "1 小時 30 分"
export function formatPracticeValue(value, type, unitLabel) {
  if (value == null) return '—';
  const v = Number(value) || 0;
  if (type === 'duration') {
    const h = Math.floor(v / 60);
    const m = v % 60;
    if (h > 0 && m > 0) return `${h} 小時 ${m} 分`;
    if (h > 0) return `${h} 小時`;
    return `${m} 分`;
  }
  return `${v} ${unitLabel || '次'}`;
}

// Convert HH:MM string to total minutes. Accept "1:30", "01:30", "0:5" etc.
export function durationStringToMinutes(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function minutesToDurationString(minutes) {
  const v = Number(minutes) || 0;
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Today's local-date string, YYYY-MM-DD, in Asia/Taipei timezone.
export function todayDateString() {
  const now = new Date();
  // Use Asia/Taipei (UTC+8) — server is UTC.
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function isoDateString(date) {
  if (typeof date === 'string') return date.slice(0, 10);
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysAgoDateString(n) {
  return addDays(todayDateString(), -n);
}

// Build a sorted list of YYYY-MM-DD between two dates (inclusive).
export function dateRange(fromStr, toStr) {
  const out = [];
  let cur = fromStr;
  while (cur <= toStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
