import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params sesuai standar Next.js 15
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID invoice tidak ditemukan." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: "Status pembayaran wajib diisi." },
        { status: 400 }
      );
    }

    // Query update status invoice
    const query = `
      UPDATE tb_invoice 
      SET status = ?, updated_at = NOW() 
      WHERE id = ?
    `;

    const [result]: any = await db.query(query, [status, id]);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: `Invoice dengan ID ${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Status invoice #${id} berhasil diperbarui menjadi ${status}.`,
    });
  } catch (err: any) {
    console.error("ERR_UPDATE_INVOICE_STATUS:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Terjadi kesalahan saat memperbarui status invoice.",
      },
      { status: 500 }
    );
  }
}