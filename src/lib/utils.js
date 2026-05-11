export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatMoney(amount) {
  return `NT$ ${Number(amount).toLocaleString('zh-TW')}`;
}

export function isDeadlinePassed(deadline) {
  return new Date(deadline) < new Date();
}

export function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
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
