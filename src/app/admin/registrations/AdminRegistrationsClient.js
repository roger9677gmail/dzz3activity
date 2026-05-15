'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { formatMoney, safeParseJSON } from '@/lib/utils';
import PaymentForm from '@/components/registrations/PaymentForm';

export default function AdminRegistrationsClient({ registrations, events, initialFilters }) {
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
                {data.receipt_number && (
                  <div className="text-xs text-blue-500 mt-1">收據：{data.receipt_number}{data.payment_date && ` ・ ${data.payment_date}`}</div>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <div className="mb-3 space-y-1">
                    {reg.items.map((item) => {
                      const names = safeParseJSON(item.names);
                      const contents = safeParseJSON(item.contents);
                      const itemTitle = item.receipt_title || reg.receipt_title || '';
                      return (
                        <div key={item.id} className="text-sm">
                          <div>
                            <span>{item.item_name} × {item.quantity}</span>
                            {names.length > 0 && <span className="text-gray-400 ml-1">（{names.join('、')}）</span>}
                          </div>
                          {contents.length > 0 && contents.some((c) => c && c.trim()) && (
                            <div className="text-xs text-gray-500 mt-0.5 pl-2">
                              超渡內容：{contents.filter((c) => c && c.trim()).join('；')}
                            </div>
                          )}
                          {itemTitle && (
                            <div className="text-xs text-gray-500 mt-0.5 pl-2">
                              收據抬頭：{itemTitle}
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
