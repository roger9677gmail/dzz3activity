'use client';
import { useState } from 'react';

export default function ReportsClient({ events }) {
  const [eventId, setEventId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  function buildUrl(format) {
    const params = new URLSearchParams({ format });
    if (eventId) params.set('eventId', eventId);
    if (paymentStatus) params.set('payment_status', paymentStatus);
    return `/api/reports?${params.toString()}`;
  }

  function quickUrl(presetPayment) {
    const params = new URLSearchParams({ format: 'xlsx' });
    if (eventId) params.set('eventId', eventId);
    if (presetPayment) params.set('payment_status', presetPayment);
    return `/api/reports?${params.toString()}`;
  }

  const reportTypes = [
    {
      title: '全部報名名單',
      desc: '所有活動、所有師兄姐的完整報名資料',
      color: 'bg-blue-50 border-blue-200',
      icon: '📋',
    },
    {
      title: '已繳款名單',
      desc: '已確認繳款的師兄姐報名記錄',
      color: 'bg-green-50 border-green-200',
      icon: '✅',
      presetPayment: 'paid',
    },
    {
      title: '待繳款名單',
      desc: '尚未繳款的師兄姐名單，可追蹤催繳',
      color: 'bg-yellow-50 border-yellow-200',
      icon: '⏳',
      presetPayment: 'unpaid',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">篩選條件</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">法會活動</label>
            <select className="input-field" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">全部活動</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">繳款狀態</label>
            <select className="input-field" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">全部</option>
              <option value="paid">已繳款</option>
              <option value="unpaid">未繳款</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick report buttons */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700">快速匯出</h3>
        {reportTypes.map((r) => (
          <div key={r.title} className={`rounded-xl p-4 border ${r.color}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <div className="font-bold text-gray-800">{r.title}</div>
                  <div className="text-sm text-gray-500">{r.desc}</div>
                </div>
              </div>
              <a
                href={quickUrl(r.presetPayment)}
                className="shrink-0 btn-secondary text-sm px-3 py-1.5"
              >
                Excel 下載
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Custom export */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">自訂匯出</h3>
        <p className="text-sm text-gray-500 mb-4">依上方篩選條件匯出客製化報表</p>
        <div className="flex gap-3 flex-wrap">
          <a href={buildUrl('xlsx')} className="flex-1 min-w-[140px] text-center btn-primary py-2.5">
            📥 下載 Excel
          </a>
          <a href={buildUrl('csv')} className="flex-1 min-w-[120px] text-center btn-secondary py-2.5">
            📄 下載 CSV
          </a>
          <a href={buildUrl('json')} target="_blank" rel="noopener noreferrer"
            className="flex-1 min-w-[120px] text-center btn-secondary py-2.5">
            🔗 查看 JSON
          </a>
        </div>
      </div>
    </div>
  );
}
