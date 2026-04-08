'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登入失敗');
      } else {
        window.location.href = '/admin';
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-temple-red-dark flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⛩️</div>
          <h1 className="text-xl font-bold text-temple-dark">佛堂管理後台</h1>
          <p className="text-sm text-gray-400 mt-1">管理員登入</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">管理員帳號（電話）</label>
            <input type="tel" required className="input-field" placeholder="管理員電話號碼"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密碼</label>
            <input type="password" required className="input-field" placeholder="管理員密碼"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary py-3">
            {loading ? '登入中...' : '管理員登入'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600">← 返回師兄姐登入</Link>
        </div>
      </div>
    </div>
  );
}
