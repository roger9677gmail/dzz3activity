'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '寄送失敗');
        setLoading(false);
        return;
      }
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch {
      setError('網路錯誤，請稍後再試');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-temple-cream flex flex-col">
      <div className="bg-temple-red px-6 py-8 text-center">
        <div className="text-4xl mb-2">⛩️</div>
        <h1 className="text-white text-xl font-bold">忘記密碼</h1>
      </div>

      <div className="flex-1 px-5 pt-8">
        <p className="text-sm text-gray-600 mb-5">
          請輸入您註冊時使用的 Email，系統將寄送 6 碼驗證碼至您的信箱。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email" required autoComplete="email" className="input-field"
              placeholder="您的 Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base">
            {loading ? '寄送中...' : '寄送驗證碼'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
            ← 返回登入
          </Link>
        </div>
      </div>
    </div>
  );
}
