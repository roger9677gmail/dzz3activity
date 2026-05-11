'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { APP_NAME, APP_VERSION } from '@/lib/version';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const disabledFlag = searchParams.get('disabled') === '1';
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // When the layout bounced a disabled-account session here, clear the stale
  // cookie immediately so it doesn't keep re-redirecting on the next nav.
  useEffect(() => {
    if (!disabledFlag) return;
    setNotice('您的帳號已停用，無法登入。請聯繫管理員。');
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, [disabledFlag]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登入失敗');
      } else {
        window.location.href = data.is_admin ? '/admin' : '/events';
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-temple-cream flex flex-col">
      {/* Top banner */}
      <div className="bg-temple-red px-6 py-8 text-center">
        <div className="text-4xl mb-2">⛩️</div>
        <h1 className="text-white text-xl font-bold">{APP_NAME}</h1>
        <p className="text-red-200 text-sm mt-1">師兄姐專屬服務平台</p>
      </div>

      <div className="flex-1 px-5 pt-8">
        <h2 className="text-xl font-bold text-temple-dark mb-6">師兄姐登入</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input-field"
              placeholder="輸入您的 Email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密碼</label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="輸入密碼"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>

          {notice && !error && (
            <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-lg border border-amber-200">
              {notice}
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base">
            {loading ? '登入中...' : '登入'}
          </button>

          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-temple-red hover:underline">
              忘記密碼？
            </Link>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            尚未加入？{' '}
            <Link href="/register" className="text-temple-red font-medium">
              立即註冊
            </Link>
          </p>
        </div>

        <div className="mt-8 mb-4 text-center">
          <p className="text-[10px] text-gray-300">{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}
