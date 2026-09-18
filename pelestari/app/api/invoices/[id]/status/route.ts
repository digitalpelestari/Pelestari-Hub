import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { subscribersDb } from '@/app/api/subscribe/route';

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status, invoiceNumber, customerName, totalAmount } = await req.json();

    // 1. Logika update status ke database di sini...
    // contoh: await db.invoice.update({ where: { id: params.id }, data: { status } });

    // 2. Jika status berubah menjadi "lunas", kirim Web Push ke akun finance & admin
    if (status.toLowerCase() === 'lunas') {
      const allowedRoles = ['finance', 'admin'];

      const targetClients = subscribersDb.filter((sub) =>
        allowedRoles.includes(sub.role)
      );

      const payload = JSON.stringify({
        title: `Invoice ${invoiceNumber} Lunas! ✅`,
        body: `Pembayaran dari ${customerName || 'Pelanggan'} sebesar Rp${Number(totalAmount).toLocaleString('id-ID')} telah diverifikasi.`,
        url: `/dashboard/finance`,
      });

      // Kirim push notification ke browser masing-masing akun target
      await Promise.allSettled(
        targetClients.map((target) =>
          webPush.sendNotification(target.subscription, payload)
        )
      );
    }

    return NextResponse.json({ success: true, message: 'Status invoice diperbarui.' });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}