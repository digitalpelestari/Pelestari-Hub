'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, CheckCircle2, Clock } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  url?: string;
}

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

interface NotificationBellProps {
  userId?: string;
  role?: string;
}

export default function NotificationBell({ userId = 'user_01', role = 'finance' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Contoh data riwayat notifikasi (bisa di-fetch dari database API nantinya)
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Invoice Lunas',
      body: 'Invoice INV/2026/001 telah dibayar lunas.',
      time: 'Baru saja',
      read: false,
      url: '/dashboard/finance',
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // 1. Setup Web Push otomatis
  useEffect(() => {
    const setupPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }

        if (perm === 'granted') {
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
          }

          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub, userId, role }),
          });
        }
      } catch (err) {
        console.error('Push registration error:', err);
      }
    };

    setupPush();
  }, [userId, role]);

  // 2. Tutup dropdown saat klik di luar area
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none"
        aria-label="Riwayat Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Riwayat Notifikasi */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-neutral-200 bg-white shadow-xl z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h4 className="font-semibold text-sm text-neutral-800">Notifikasi</h4>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Tandai dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-neutral-500">
                Belum ada notifikasi baru.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 text-sm hover:bg-neutral-50 transition-colors cursor-pointer ${
                    !item.read ? 'bg-blue-50/40' : ''
                  }`}
                  onClick={() => {
                    if (item.url) window.location.href = item.url;
                  }}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900 leading-snug">{item.title}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{item.body}</p>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2 text-center">
            <a href="/dashboard/finance" className="text-xs text-neutral-600 hover:text-neutral-900">
              Lihat semua transaksi →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}