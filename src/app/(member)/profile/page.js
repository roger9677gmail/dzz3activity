'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">載入中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">個人資料</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar and name */}
        <div className="card p-6 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-temple-red flex items-center justify-center text-white text-3xl font-bold mb-3">
            {user.name?.[0] || '?'}
          </div>
          <h2 className="text-xl font-bold text-temple-dark">{user.name}</h2>
          <span className="text-sm text-gray-500 mt-1">師兄姐</span>
        </div>

        {/* User info */}
        <div className="card divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">電話</span>
            <span className="text-sm font-medium">{user.phone}</span>
          </div>
          {user.email && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">加入日期</span>
            <span className="text-sm font-medium">{user.created_at?.slice(0, 10)}</span>
          </div>
        </div>

        {/* App info */}
        <div className="card p-4">
          <h3 className="font-medium text-sm text-gray-700 mb-2">關於本系統</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            佛堂法會報名系統讓師兄姐可以便利地報名各項法會活動，查看報名紀錄，並接收活動提醒通知。
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full btn-secondary text-red-600 border-red-200"
        >
          {loggingOut ? '登出中...' : '登出'}
        </button>
      </div>
    </div>
  );
}
