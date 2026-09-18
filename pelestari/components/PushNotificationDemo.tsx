'use client';

import { useEffect, useState } from 'react';

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

export default function PushNotificationDemo() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Jalankan registrasi dan subscription otomatis begitu komponen ter-mount
    const initPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notification tidak didukung di browser ini.');
        return;
      }

      try {
        // 1. Daftarkan Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // 2. Minta izin otomatis jika belum ditentukan
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        // Jika user mengizinkan (atau sebelumnya sudah pernah izinkan)
        if (permission === 'granted') {
          // Cek apakah sudah ada subscription aktif
          let subscription = await registration.pushManager.getSubscription();

          // Jika belum ada, buat subscription baru
          if (!subscription) {
            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            // Kirim ke backend API
            await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription }),
            });
          }

          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Gagal inisialisasi push notification otomatis:', error);
      }
    };

    initPush();
  }, []);

  // Endpoint uji coba kirim pesan
  const triggerTestNotification = async () => {
    await fetch('/api/subscribe');
  };

  return (
    <div className="flex items-center gap-2">
      {isSubscribed && (
        <button
          onClick={triggerTestNotification}
          className="px-3 py-1 text-xs bg-neutral-800 text-white rounded hover:bg-neutral-900 transition-colors"
        >
          Tes Notif
        </button>
      )}
    </div>
  );
}