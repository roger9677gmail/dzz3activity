'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
        × <input type="number" min={1} value={val} onChange={(e) => setVal(e.target.value)}
          className="w-16 border border-gray-300 rounded px-1 text-sm" autoFocus />
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

export default function RegistrationPaymentInline({ reg }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [currentReg, setCurrentReg] = useState(reg);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-gray-800">{reg.member_name}</div>
            <div className="text-sm text-gray-500">{reg.member_phone}</div>
            <div className="text-xs text-gray-400 mt-1">
              {reg.items.map((i) => `${i.item_name}×${i.quantity}`).join(' · ')}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              currentReg.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'
            }`}>
              {currentReg.payment_status === 'paid' ? '已繳款' : '待繳款'}
            </span>
            <span className="font-bold text-temple-red text-sm">{formatMoney(reg.total_amount)}</span>
            <span className="text-xs text-gray-400">{expanded ? '▲ 收合' : '▼ 繳款登錄'}</span>
          </div>
        </div>
        {(() => {
          const nums = Array.from(new Set(
            (currentReg.items || reg.items || [])
              .map((i) => (i.receipt_number || '').toString().trim())
              .filter(Boolean)
          ));
          const display = nums.length > 0 ? nums.join('、') : (currentReg.receipt_number || '');
          if (!display) return null;
          return (
            <div className="text-xs text-blue-500 mt-1.5">
              收據：{display} {currentReg.payment_date && `・ ${currentReg.payment_date}`}
            </div>
          );
        })()}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {/* Items detail */}
          <div className="mb-3 space-y-1">
            {reg.items.map((item) => {
              const names = safeParseJSON(item.names);
              const itemTitle = item.receipt_title || reg.receipt_title || '';
              const itemNumber = (currentReg.items?.find((d) => d.id === item.id)?.receipt_number) || item.receipt_number || '';
              return (
                <div key={item.id} className="text-sm">
                  <div>
                    <span className="text-gray-700">{item.item_name} </span>
                    <ItemQtyEditor item={item} onSaved={() => router.refresh()} />
                    {names.length > 0 && <span className="text-gray-400 ml-1">（{names.join('、')}）</span>}
                  </div>
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
          </div>
          {reg.notes && <div className="text-xs text-gray-400 mb-3">備註：{reg.notes}</div>}
          <PaymentForm registration={currentReg} onSuccess={(updated) => setCurrentReg((p) => ({ ...p, ...updated }))} />
        </div>
      )}
    </div>
  );
}
