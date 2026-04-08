'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone, email: form.email, password: form.password }),
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

  return (
    <div className="min-h-screen bg-temple-cream flex flex-col">
      <div className="bg-temple-red px-6 py-6 text-center">
        <div className="text-3xl mb-1">⛩️</div>
        <h1 className="text-white text-lg font-bold">佛堂法會報名系統</h1>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">電話號碼 *</label>
            <input type="tel" required className="input-field" placeholder="作為登入帳號使用"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email（選填）</label>
            <input type="email" className="input-field" placeholder="選填"
              value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
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
