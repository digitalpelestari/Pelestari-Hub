// app/test-push/page.tsx
'use client';

import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function TestPushPage() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  const subscribeUser = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      setIsSubscribed(true);
      alert('Berhasil subscribe push notification!');
    } catch (error) {
      console.error('Gagal subscribe:', error);
      alert('Gagal subscribe. Pastikan izin notifikasi diberikan.');
    } finally {
      setLoading(false);
    }
  };

  const triggerTestNotification = async () => {
    await fetch('/api/subscribe');
  };

  return (
    <main className="p-8">
      <div className="p-6 max-w-md border rounded-lg space-y-4">
        <h3 className="font-semibold text-lg">Web Push Notification</h3>
        {!isSubscribed ? (
          <button
            onClick={subscribeUser}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Aktifkan Notifikasi'}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-green-600 text-sm font-medium">✓ Notifikasi aktif</p>
            <button
              onClick={triggerTestNotification}
              className="px-4 py-2 bg-neutral-800 text-white rounded hover:bg-neutral-900"
            >
              Kirim Uji Coba Notifikasi
            </button>
          </div>
        )}
      </div>
    </main>
  );
}