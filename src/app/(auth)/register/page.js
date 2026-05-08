'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '', location_id: '', address: '', code: '' });
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0); // seconds remaining before next resend allowed
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/locations').then((r) => r.json()).then((d) => setLocations(d.locations || [])).catch(() => {});
  }, []);

  // Resend cooldown countdown.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function handleSendCode() {
    setError('');
    setInfo('');
    const email = form.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('請先填正確的 Email');
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '發送驗證碼失敗');
      } else {
        setCodeSent(true);
        setInfo('驗證碼已寄出，請至信箱查收（15 分鐘內有效）');
        setResendIn(60);
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setSendingCode(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (form.password !== form.confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }
    if (!form.code.trim()) {
      setError('請輸入 Email 驗證碼');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          password: form.password,
          location_id: form.location_id || null,
          address: form.address || null,
          code: form.code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '註冊失敗');
      } else {
        window.location.href = '/events';
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  const sendDisabled = sendingCode || resendIn > 0;
  const sendLabel = sendingCode
    ? '發送中…'
    : resendIn > 0
      ? `重新發送（${resendIn}s）`
      : codeSent ? '重新發送驗證碼' : '發送驗證碼';

  return (
    <div className="min-h-screen bg-temple-cream flex flex-col">
      <div className="bg-temple-red px-6 py-6 text-center">
        <div className="text-3xl mb-1">⛩️</div>
        <h1 className="text-white text-lg font-bold">大自在山活動報名系統</h1>
      </div>

      <div className="flex-1 px-5 pt-6 pb-8">
        <h2 className="text-xl font-bold text-temple-dark mb-5">新師兄姐註冊</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名 *</label>
            <input type="text" required className="input-field" placeholder="您的姓名"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <div className="flex gap-2">
              <input type="email" required autoComplete="email" className="input-field flex-1" placeholder="作為登入帳號使用"
                value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sendDisabled}
                className="shrink-0 px-3 text-sm rounded-lg border border-temple-red text-temple-red font-medium disabled:opacity-50 disabled:border-gray-300 disabled:text-gray-400"
              >
                {sendLabel}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email 驗證碼 *</label>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input-field tracking-[0.4em]"
              placeholder="請輸入 6 位數驗證碼"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              先點右上的「發送驗證碼」，至 Email 收信後在這裡輸入。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">電話號碼（選填）</label>
            <input type="tel" className="input-field" placeholder="選填，方便聯絡"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">所屬道場（選填）</label>
            <select className="input-field"
              value={form.location_id}
              onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}>
              <option value="">— 請選擇 —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">地址（選填）</label>
            <input type="text" className="input-field" placeholder="收據寄送或聯絡用"
              value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密碼 *（至少6碼）</label>
            <input type="password" required minLength={6} className="input-field" placeholder="設定密碼"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">確認密碼 *</label>
            <input type="password" required className="input-field" placeholder="再次輸入密碼"
              value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} />
          </div>

          {info && (
            <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-lg border border-amber-200">{info}</div>
          )}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base">
            {loading ? '註冊中...' : '立即註冊'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm text-gray-500">
            已有帳號？{' '}
            <Link href="/login" className="text-temple-red font-medium">返回登入</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
