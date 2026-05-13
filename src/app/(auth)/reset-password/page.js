'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const [form, setForm] = useState({
    email: initialEmail,
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: form.code, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '重設失敗');
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  async function handleResend() {
    setResending(true);
    setResendMsg('');
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '寄送失敗');
      } else {
        setResendMsg('已重新寄送驗證碼');
      }
    } catch {
      setError('網路錯誤');
    }
    setResending(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-temple-cream flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-sm">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-temple-dark mb-2">密碼重設成功</h2>
          <p className="text-sm text-gray-500">即將為您導向登入頁...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-temple-cream flex flex-col">
      <div className="bg-temple-red px-6 py-8 text-center">
        <div className="text-4xl mb-2">⛩️</div>
        <h1 className="text-white text-xl font-bold">重設密碼</h1>
      </div>

      <div className="flex-1 px-5 pt-8">
        <p className="text-sm text-gray-600 mb-5">
          請輸入寄至您 Email 的 6 碼驗證碼，並設定新密碼。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email" required className="input-field" autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">驗證碼</label>
            <input
              type="text" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              className="input-field tracking-[0.5em] text-center text-lg"
              placeholder="000000"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.replace(/\D/g, '') }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">新密碼（至少 8 碼）</label>
            <input
              type="password" required minLength={8} className="input-field"
              placeholder="設定新密碼" autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">確認新密碼</label>
            <input
              type="password" required className="input-field"
              placeholder="再次輸入新密碼" autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
          )}
          {resendMsg && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200">{resendMsg}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base">
            {loading ? '處理中...' : '重設密碼'}
          </button>

          <button type="button" onClick={handleResend} disabled={resending || !form.email}
            className="w-full text-sm text-temple-red hover:underline disabled:text-gray-300">
            {resending ? '寄送中...' : '沒收到信？重新寄送驗證碼'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">← 返回登入</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
