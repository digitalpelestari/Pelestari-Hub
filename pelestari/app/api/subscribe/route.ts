import { NextResponse } from 'next/server';

export interface PushSubscriber {
  subscription: any;
  userId: string;
  role: string;
}

// Simulasi database store
export const subscribersDb: PushSubscriber[] = [];

export async function POST(req: Request) {
  try {
    const { subscription, userId, role } = await req.json();

    // Hapus duplikat subscription lama jika endpoint-nya sama
    const existingIndex = subscribersDb.findIndex(
      (s) => s.subscription.endpoint === subscription.endpoint
    );

    if (existingIndex > -1) {
      subscribersDb[existingIndex] = { subscription, userId, role };
    } else {
      subscribersDb.push({ subscription, userId, role });
    }

    return NextResponse.json({ success: true, message: 'Langganan berhasil disimpan' });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}