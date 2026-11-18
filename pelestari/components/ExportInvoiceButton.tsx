"use client";

import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface ExportProps {
  data: any[];
}

export default function ExportInvoiceButton({ data }: ExportProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }

    const dataToExport = data.map((inv) => {
      // Detail layanan sudah berada di inv.items dari getInvoices()
      const invoiceItems = Array.isArray(inv.items) ? [...inv.items] : [];

      // Urutkan agar item pertama masuk Layanan 1, berikutnya Layanan 2
      invoiceItems.sort(
        (a, b) => Number(a.id || 0) - Number(b.id || 0)
      );

      const item1 = invoiceItems[0];
      const item2 = invoiceItems[1];

      const totalTagihan = Number(inv.total) || 0;
      const totalBayar =
        (Number(inv.bayar_1) || 0) + (Number(inv.bayar_2) || 0);

      return {
        "Nomor Invoice": inv.nomor_invoice || "-",
        Batch: inv.batch || "-",
        "Perusahaan Tujuan": inv.perusahaan_tujuan || "-",
        NPWP: inv.npwp || "-",
        "Tanggal Invoice": inv.tanggal || "-",
        "Jatuh Tempo":
          inv.tanggal_jatuhtempo || inv.tanggal_jatuh_tempo || "-",
        "Umur Piutang (Hari)":
          inv.status === "Lunas" ? 0 : Number(inv.umur_piutang) || 0,

        "Layanan 1": item1?.item_deskripsi || inv.keterangan || "-",
        "Peserta 1":
          Number(item1?.item_jumlah ?? inv.jumlah_peserta) || 0,
        "Layanan 2": item2?.item_deskripsi || inv.keterangan_2 || "-",
        "Peserta 2":
          Number(item2?.item_jumlah ?? inv.jumlah_peserta_2) || 0,

        "Total Tagihan": totalTagihan,
        "Total Bayar": totalBayar,
        "Sisa Tagihan": totalTagihan - totalBayar,
        Status: inv.status || "-",
        "PPH 23": inv.is_pph23 ? "Ya" : "Tidak",
        "PPN 11": inv.is_ppn11 ? "Ya" : "Tidak",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 28 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 55 },
      { wch: 12 },
      { wch: 55 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Invoice");

    XLSX.writeFile(workbook, `Export_Invoice_${Date.now()}.xlsx`);
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      className="border-zinc-300 text-[12px] text-zinc-700 hover:bg-zinc-100 uppercase font-semibold shadow-sm gap-2"
    >
      <FileDown className="w-4 h-4" />
      Export Excel
    </Button>
  );
}