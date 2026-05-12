'use client';
import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { APP_NAME, APP_VERSION } from '@/lib/version';

const REMEMBERED_EMAIL_KEY = 'dzz3activity:last_login_email';

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
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  // Track whether we recovered an email from localStorage so we can land
  // focus on the password field instead of email (faster login).
  const [hasRememberedEmail, setHasRememberedEmail] = useState(false);

  // Prefill email from a previous successful login (client-only — never
  // persists a password). Runs once on mount.
  useEffect(() => {
    try {
      const remembered = window.localStorage?.getItem(REMEMBERED_EMAIL_KEY);
      if (remembered) {
        setForm((p) => ({ ...p, email: remembered }));
        setHasRememberedEmail(true);
      }
    } catch {
      // Private mode / storage disabled — silently skip.
    }
  }, []);

  // Send focus to password field if we already have an email; otherwise email.
  useEffect(() => {
    if (hasRememberedEmail) passwordInputRef.current?.focus();
    else emailInputRef.current?.focus();
  }, [hasRememberedEmail]);

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
        try {
          window.localStorage?.setItem(REMEMBERED_EMAIL_KEY, form.email.trim());
        } catch {
          // Storage disabled — login still succeeds, just no convenience.
        }
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
      </div>

      <div className="flex-1 px-5 pt-8">
        <h2 className="text-xl font-bold text-temple-dark mb-6">師兄姐登入</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              ref={emailInputRef}
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
              ref={passwordInputRef}
              type="password"
              required
              autoComplete="current-password"
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
