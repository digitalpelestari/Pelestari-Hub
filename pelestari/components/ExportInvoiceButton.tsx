"use client";

import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface ExportProps {
  data: any[];
}

export default function ExportInvoiceButton({ data }: ExportProps) {
  const handleExport = () => {
    if (data.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }

    // 1. Map data dengan key yang sesuai dengan struktur database Anda
    const dataToExport = data.map((inv) => {
      // Hitung Sisa Tagihan secara manual untuk Excel
      const totalTagihan = Number(inv.total) || 0;
      const totalBayar = (Number(inv.bayar_1) || 0) + (Number(inv.bayar_2) || 0);
      const sisaTagihan = totalTagihan - totalBayar;

      return {
        "Nomor Invoice": inv.nomor_invoice,
        "Batch": inv.batch || "-",
        "Perusahaan Tujuan": inv.perusahaan_tujuan,
        "NPWP": inv.npwp || "-",
        "Tanggal Invoice": inv.tanggal,
        "Jatuh Tempo": inv.tanggal_jatuhtempo || inv.tanggal_jatuh_tempo || "-",
        "Umur Piutang (Hari)": inv.status === "Lunas" ? 0 : (inv.umur_piutang || 0),
        "Layanan 1": inv.keterangan || "-",
        "Peserta 1": inv.jumlah_peserta || 0,
        "Layanan 2": inv.keterangan_2 || "-",
        "Peserta 2": inv.jumlah_peserta_2 || 0,
        "Total Tagihan": totalTagihan,
        "Total Bayar": totalBayar,
        "Sisa Tagihan": sisaTagihan, 
        "Status": inv.status,
        "PPH 23": inv.is_pph23 ? "Ya" : "Tidak",
        "PPN 11": inv.is_ppn11 ? "Ya" : "Tidak",
      };
    });

    // 2. Buat worksheet
    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Atur lebar kolom agar rapi (Opsional)
    const wscols = [
      { wch: 20 }, // No Invoice
      { wch: 10 }, // Batch
      { wch: 15 }, // Tanggal
      { wch: 15 }, // Jatuh Tempo
      { wch: 30 }, // Perusahaan
      { wch: 20 }, // NPWP
      { wch: 30 }, // Layanan
      { wch: 15 }, // Total
      { wch: 15 }, // Sisa
    ];
    ws["!cols"] = wscols;

    // 3. Buat workbook dan simpan
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Invoice");

    XLSX.writeFile(wb, `Export_Invoice_${new Date().getTime()}.xlsx`);
  };

  return (
    <Button 
      onClick={handleExport} 
      variant="outline" 
      className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-semibold shadow-sm gap-2"
    >
      <FileDown className="w-4 h-4" />
      Export Excel
    </Button>
  );
}