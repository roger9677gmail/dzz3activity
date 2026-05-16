'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { formatMoney, safeParseJSON } from '@/lib/utils';
import PaymentForm from '@/components/registrations/PaymentForm';

function ItemQtyEditor({ item, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.quantity);
  const [saving, setSaving] = useState(false);
  const canEdit = !item.is_gift && !item.allow_custom_price;

  if (!canEdit) return <span>× {item.quantity}</span>;

  async function save() {
    const n = parseInt(val);
    if (!Number.isFinite(n) || n < 1) return;
    if (n === item.quantity) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/registrations/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: n }),
      });
      if (res.ok) {
        onSaved && onSaved(n);
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '修改失敗');
      }
    } catch {
      alert('網路錯誤');
    }
    setSaving(false);
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        × <input
          type="number"
          min={1}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-16 border border-gray-300 rounded px-1 text-sm"
          autoFocus
        />
        <button onClick={save} disabled={saving} className="text-xs text-temple-red px-1">{saving ? '...' : '✓'}</button>
        <button onClick={() => { setVal(item.quantity); setEditing(false); }} className="text-xs text-gray-400 px-1">✕</button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      × {item.quantity}
      <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-temple-red ml-1" title="修改數量">✏️</button>
    </span>
  );
}

export default function AdminRegistrationsClient({ registrations, events, initialFilters, canDelete }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(initialFilters);
  const [expandedId, setExpandedId] = useState(null);
  const [regMap, setRegMap] = useState({});

  function applyFilters(newFilters) {
    const f = { ...filters, ...newFilters };
    setFilters(f);
    const params = new URLSearchParams();
    if (f.eventId) params.set('eventId', f.eventId);
    if (f.paymentStatus) params.set('payment_status', f.paymentStatus);
    if (f.search) params.set('search', f.search);
    router.push(`${pathname}?${params.toString()}`);
  }

  function getRegData(reg) {
    return regMap[reg.id] || reg;
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">法會活動</label>
            <select className="input-field text-sm" value={filters.eventId}
              onChange={(e) => applyFilters({ eventId: e.target.value })}>
              <option value="">全部活動</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">繳款狀態</label>
            <select className="input-field text-sm" value={filters.paymentStatus}
              onChange={(e) => applyFilters({ paymentStatus: e.target.value })}>
              <option value="">全部</option>
              <option value="unpaid">未繳款</option>
              <option value="paid">已繳款</option>
            </select>
          </div>
        </div>
        <input type="text" className="input-field text-sm" placeholder="搜尋姓名、電話、收據號碼..."
          value={filters.search}
          onChange={(e) => applyFilters({ search: e.target.value })}
        />
        <div className="text-xs text-gray-400">共 {registrations.length} 筆記錄</div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {registrations.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">無符合條件的報名記錄</div>
        )}
        {registrations.map((reg) => {
          const data = getRegData(reg);
          const isExpanded = expandedId === reg.id;
          return (
            <div key={reg.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <button className="w-full text-left p-4" onClick={() => setExpandedId(isExpanded ? null : reg.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-800">{reg.member_name}</div>
                    <div className="text-xs text-gray-500">{reg.member_phone} ・ {reg.event_name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {reg.items.map((i) => `${i.item_name}×${i.quantity}`).join(' · ')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      data.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'
                    }`}>
                      {data.payment_status === 'paid' ? '已繳款' : '待繳款'}
                    </span>
                    <span className="font-bold text-temple-red text-sm">{formatMoney(reg.total_amount)}</span>
                  </div>
                </div>
                {(() => {
                  const nums = Array.from(new Set(
                    (data.items || reg.items || [])
                      .map((i) => (i.receipt_number || '').toString().trim())
                      .filter(Boolean)
                  ));
                  const display = nums.length > 0 ? nums.join('、') : (data.receipt_number || '');
                  if (!display) return null;
                  return (
                    <div className="text-xs text-blue-500 mt-1">收據：{display}{data.payment_date && ` ・ ${data.payment_date}`}</div>
                  );
                })()}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <div className="mb-3 space-y-1">
                    {reg.items.map((item) => {
                      const names = safeParseJSON(item.names);
                      const contents = safeParseJSON(item.contents);
                      const itemTitle = item.receipt_title || reg.receipt_title || '';
                      const itemNumber = (data.items?.find((d) => d.id === item.id)?.receipt_number) || item.receipt_number || '';
                      return (
                        <div key={item.id} className="text-sm">
                          <div>
                            <span>{item.item_name} </span>
                            <ItemQtyEditor
                              item={item}
                              onSaved={() => router.refresh()}
                            />
                            {names.length > 0 && <span className="text-gray-400 ml-1">（{names.join('、')}）</span>}
                          </div>
                          {contents.length > 0 && contents.some((c) => c && c.trim()) && (
                            <div className="text-xs text-gray-500 mt-0.5 pl-2">
                              超渡內容：{contents.filter((c) => c && c.trim()).join('；')}
                            </div>
                          )}
                          {(itemTitle || itemNumber) && (
                            <div className="text-xs text-gray-500 mt-0.5 pl-2">
                              {itemTitle && <>收據抬頭：{itemTitle}</>}
                              {itemTitle && itemNumber && <span className="mx-1">・</span>}
                              {itemNumber && <span className="text-blue-500">收據單號：{itemNumber}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {reg.notes && <div className="text-xs text-gray-400 mt-1">備註：{reg.notes}</div>}
                  </div>
                  <PaymentForm
                    registration={data}
                    onSuccess={(updated) => {
                      setRegMap((prev) => ({ ...prev, [reg.id]: { ...data, ...updated } }));
                    }}
                  />
                  {canDelete ? (
                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                      <button
                        onClick={async () => {
                          if (!confirm(`確定要永久刪除 ${reg.member_name} 在「${reg.event_name}」的「祈福報名」？\n\n會員的「活動登記」（交通／住宿／用餐等）會保留。`)) return;
                          const res = await fetch(`/api/registrations/${reg.id}`, { method: 'DELETE' });
                          if (res.ok) router.refresh();
                          else { const d = await res.json().catch(() => ({})); alert(d.error || '刪除失敗'); }
                        }}
                        className="block text-xs text-red-600 hover:text-red-800 hover:underline"
                      >
                        🗑️ 永久刪除「祈福報名」（保留活動登記）
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`確定要永久刪除 ${reg.member_name} 在「${reg.event_name}」的所有資料？\n\n包含「祈福報名」+「活動登記」（題目答案）。\n此操作無法復原，會員需重新填寫。`)) return;
                          const res = await fetch(`/api/registrations/${reg.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ wipe: 'all' }),
                          });
                          if (res.ok) router.refresh();
                          else { const d = await res.json().catch(() => ({})); alert(d.error || '刪除失敗'); }
                        }}
                        className="block text-xs text-red-700 hover:text-red-900 hover:underline font-medium"
                      >
                        🗑️ 永久刪除「祈福報名 + 活動登記」（整筆清乾淨）
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
