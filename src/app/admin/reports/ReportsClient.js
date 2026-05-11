'use client';
import { useState } from 'react';

const TABS = [
  { key: 'qf', label: '祈福報名' },
  { key: 'attendance', label: '活動報名' },
];

export default function ReportsClient({ events }) {
  const [tab, setTab] = useState('qf');

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t.key
                ? 'border-temple-red text-temple-red font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >{t.label}</button>
        ))}
      </div>
      {tab === 'qf' ? <QfReports events={events} /> : <AttendanceReports events={events} />}
    </div>
  );
}

function QfReports({ events }) {
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
    { title: '全部祈福名單', desc: '所有活動、所有師兄姐的完整祈福報名資料', color: 'bg-blue-50 border-blue-200', icon: '📋' },
    { title: '已繳款名單', desc: '已確認繳款的師兄姐記錄', color: 'bg-green-50 border-green-200', icon: '✅', presetPayment: 'paid' },
    { title: '待繳款名單', desc: '尚未繳款的師兄姐名單，可追蹤催繳', color: 'bg-yellow-50 border-yellow-200', icon: '⏳', presetPayment: 'unpaid' },
  ];

  return (
    <div className="space-y-6">
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

      <div className="space-y-3">
        <h3 className="font-bold text-gray-700">快速匯出</h3>
        {reportTypes.map((r) => (
          <div key={r.title} className={`rounded-xl p-4 border ${r.color}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{r.icon}</span>
                <div>
                  <div className="font-bold text-gray-800">{r.title}</div>
                  <div className="text-sm text-gray-500">{r.desc}</div>
                </div>
              </div>
              <a href={quickUrl(r.presetPayment)} className="shrink-0 btn-secondary text-sm px-3 py-1.5">
                Excel 下載
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">自訂匯出</h3>
        <p className="text-sm text-gray-500 mb-4">依上方篩選條件匯出 Excel 報表</p>
        <a href={buildUrl('xlsx')} className="block text-center btn-primary py-2.5">
          📥 下載 Excel
        </a>
      </div>
    </div>
  );
}

function AttendanceReports({ events }) {
  const [eventId, setEventId] = useState('');
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">選擇活動</h3>
        <p className="text-sm text-gray-500 mb-3">
          活動報名 (用餐 / 禪修 / 朝山等) 是以「每場活動一份名單」的形式匯出，請先指定要匯出的法會活動。
        </p>
        <select
          className="input-field"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">— 請選擇法會活動 —</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">匯出</h3>
        <p className="text-sm text-gray-500 mb-4">
          一列＝一個人（本人 / 親友），含「登記對象 / 關係」與所有題目欄位。
          多日期勾選 (multi_date) 會展開為一日一欄。
        </p>
        {eventId ? (
          <a
            href={`/api/admin/events/${eventId}/attendance/export`}
            className="block text-center btn-primary py-2.5"
          >📥 下載活動報名 Excel</a>
        ) : (
          <button type="button" disabled className="block w-full text-center btn-primary py-2.5">
            請先選擇法會活動
          </button>
        )}
      </div>
    </div>
  );
}
