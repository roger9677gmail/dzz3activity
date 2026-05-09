'use client';
import { useState } from 'react';

const PRESETS = [
  { title: '活動提醒', body: '親愛的師兄姐，法會活動即將舉行，請記得準時參加，阿彌陀佛！' },
  { title: '報名截止提醒', body: '親愛的師兄姐，法會報名即將截止，尚未報名的師兄姐請抓緊時間！' },
  { title: '繳款提醒', body: '親愛的師兄姐，您的報名已確認，請盡快至服務台完成繳款，謝謝！' },
];

export default function NotificationsClient({ events, subCount }) {
  const [form, setForm] = useState({ title: '', body: '', url: '', eventId: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function applyPreset(preset) {
    setForm((p) => ({ ...p, title: preset.title, body: preset.body }));
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.title || !form.body) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: '傳送失敗' });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5 max-w-xl">
      {/* Presets */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">快速範本</h3>
        <div className="space-y-2">
          {PRESETS.map((p) => (
            <button key={p.title} onClick={() => applyPreset(p)}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-temple-red hover:bg-red-50 transition-colors">
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{p.body}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSend} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-700">自訂推播訊息</h3>

        <div>
          <label className="block text-sm text-gray-600 mb-1">通知標題 *</label>
          <input type="text" required className="input-field" placeholder="例：法會活動提醒"
            value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">通知內容 *</label>
          <textarea required className="input-field resize-none" rows={3}
            placeholder="輸入推播通知內容..."
            value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">傳送對象</label>
          <select className="input-field" value={form.eventId}
            onChange={(e) => setForm((p) => ({ ...p, eventId: e.target.value }))}>
            <option value="">全體師兄姐（{subCount} 人）</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name} 已報名者（{ev.sub_count || 0} 人）</option>
            ))}
          </select>
        </div>

        {result && (
          <div className={`text-sm px-4 py-3 rounded-lg ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {result.error || `✅ 成功傳送給 ${result.sent} / ${result.total} 位師兄姐`}
          </div>
        )}

        {(() => {
          const targetCount = form.eventId
            ? (events.find((ev) => String(ev.id) === String(form.eventId))?.sub_count || 0)
            : subCount;
          return (
            <>
              <button type="submit" disabled={loading || targetCount === 0}
                className="w-full btn-primary py-3 disabled:opacity-50">
                {loading ? '傳送中...' : `🔔 發送推播通知（${targetCount}人）`}
              </button>
              {targetCount === 0 && (
                <p className="text-xs text-gray-400 text-center">
                  {form.eventId ? '此活動已報名者尚無人開啟推播通知' : '目前沒有師兄姐開啟推播通知'}
                </p>
              )}
            </>
          );
        })()}
      </form>
    </div>
  );
}
