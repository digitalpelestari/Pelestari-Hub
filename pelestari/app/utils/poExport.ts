import { jsPDF } from "jspdf";
// Import explicit untuk mencegah error autoTable is not a function di Next.js Client Component
import autoTable from "jspdf-autotable"; 

// =========================================================================
// 1. HELPER: WAJIB DI BARIS PALING ATAS
// Murni mengubah path file /logo.png di folder public menjadi Base64 String
// =========================================================================
const loadImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Gagal membuat canvas context"));
      }
    };
    img.onerror = (error) => reject(error);
  });
};

// =========================================================================
// 2. EXPORT MASSAL DAFTAR REKAP PO TO EXCEL (Dari Tombol Halaman Utama)
// =========================================================================
export const exportToExcel = (poList: any[]) => {
  if (poList.length === 0) {
    alert("Tidak ada data PO untuk diexport!");
    return;
  }
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><style>
      table { border-collapse: collapse; font-family: Arial; font-size: 11px; }
      .header { background-color: #1F4E78; color: white; font-weight: bold; text-align: center; }
      .cell { border: 1px solid #BFBFBF; padding: 5px; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
    </style></head>
    <body>
    <h2>PT PEDULI LESTARI INDONESIA</h2>
    <h3>Laporan Rekapitulasi Daftar Purchase Order (HRGA)</h3>
    <table border="1">
      <tr height="25">
        <th class="header">No</th>
        <th class="header">Nomor PO</th>
        <th class="header">Tanggal</th>
        <th class="header">Vendor Target</th>
        <th class="header">Sub Total</th>
        <th class="header">Total Akhir</th>
        <th class="header">Status</th>
      </tr>`;
  
  poList.forEach((po, index) => {
    html += `
      <tr height="20">
        <td class="cell text-center">${index + 1}</td>
        <td class="cell">${po.nomor_po}</td>
        <td class="cell text-center">${new Date(po.tanggal_po).toLocaleDateString("id-ID")}</td>
        <td class="cell">${po.vendor_nama}</td>
        <td class="cell text-right">Rp ${Number(po.sub_total).toLocaleString("id-ID")}</td>
        <td class="cell text-right">Rp ${Number(po.total_harga).toLocaleString("id-ID")}</td>
        <td class="cell text-center">${po.status_pembayaran}</td>
      </tr>`;
  });
  
  html += "</table></body></html>";

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rekap_Daftar_PO_${new Date().getFullYear()}.xls`;
  a.click();
};

// =========================================================================
// 3. EXPORT MASSAL DAFTAR REKAP PO TO PDF (Dari Tombol Halaman Utama)
// =========================================================================
export const exportToPdf = (poList: any[]) => {
  if (poList.length === 0) {
    alert("Tidak ada data PO!");
    return;
  }
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PT PEDULI LESTARI INDONESIA", 14, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Laporan Rekapitulasi Daftar Purchase Order (HRGA)", 14, 21);

  const tableRows = poList.map((po, index) => [
    index + 1,
    po.nomor_po,
    new Date(po.tanggal_po).toLocaleDateString("id-ID"),
    po.vendor_nama,
    `Rp ${Number(po.sub_total).toLocaleString("id-ID")}`,
    `Rp ${Number(po.total_harga).toLocaleString("id-ID")}`,
    po.status_pembayaran
  ]);

  autoTable(doc, {
    startY: 26,
    head: [["No", "Nomor PO", "Tanggal", "Vendor Target", "Sub Total", "Total Akhir", "Status"]],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [31, 78, 120] },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "center" } }
  });
  doc.save("Rekap_Daftar_PO.pdf");
};

// =========================================================================
// 4. EXPORT SATUAN LEMBARAN PO TO EXCEL (Mirip Persis image_97117a.png dengan logo web)
// =========================================================================
export const exportSinglePoToExcel = async (po: any, items: any[]) => {
  if (!po) return;

  let logoHtml = "Pelestari";
  try {
    const base64Img = await loadImageAsBase64("/logo.png");
    logoHtml = `<img src="${base64Img}" width="55" height="55" />`;
  } catch (e) {
    console.error("Gagal load logo ke excel, menggunakan fallback teks");
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><style>
      table { border-collapse: collapse; font-family: 'Arial', sans-serif; font-size: 11px; }
      td { vertical-align: middle; }
      .title { font-size: 16px; font-weight: bold; text-align: center; }
      .po-num { font-size: 11px; text-align: center; }
      .th-baju { background-color: #B4C6E7; color: #000000; font-weight: bold; border: 1px solid #000000; text-align: center; }
      .td-border { border: 1px solid #000000; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
    </style></head>
    <body>
    <table>
      <tr>
        <td colspan="2" rowspan="2" align="center" style="border: 1px solid #000000;">${logoHtml}</td>
        <td colspan="4" class="title">PURCHASE ORDER</td>
      </tr>
      <tr>
        <td colspan="4" class="po-num">PO Number : ${po.nomor_po}</td>
      </tr>
      <tr><td colspan="6"></td></tr>

      <tr>
        <td colspan="3" class="font-bold">Alamat Perusahaan</td>
        <td colspan="2" class="font-bold">PO Date :</td>
        <td align="right">${new Date(po.tanggal_po).toLocaleDateString("id-ID")}</td>
      </tr>
      <tr>
        <td colspan="3">PT Peduli Lestari Indonesia</td>
        <td colspan="2" class="font-bold">Vendor:</td>
        <td align="right" class="font-bold">${po.vendor_nama}</td>
      </tr>
      <tr>
        <td colspan="3">NPWP : 0423 0271 5040 4000</td>
        <td colspan="2" class="font-bold">PIC Hub:</td>
        <td align="right">${po.vendor_pic || "-"}</td>
      </tr>
      <tr>
        <td colspan="3">Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008</td>
        <td colspan="2" class="font-bold">Email:</td>
        <td align="right" style="color: blue; text-decoration: underline;">${po.vendor_email || "-"}</td>
      </tr>
      <tr>
        <td colspan="3">Kedung Halang, Bogor Utara, Kota Bogor, Jawa Barat</td>
        <td colspan="3"></td>
      </tr>
      <tr><td colspan="6"></td></tr>

      <tr height="25">
        <td class="th-baju" style="width: 45px;">No</td>
        <td class="th-baju" style="width: 220px;">Transaksi</td>
        <td class="th-baju" style="width: 85px;">Ukuran</td>
        <td class="th-baju" style="width: 75px;">Quantity</td>
        <td class="th-baju" style="width: 115px;">Unit Price</td>
        <td class="th-baju" style="width: 125px;">Total</td>
      </tr>`;

  // Baris Isi Tabel Barang Ber-border Hitam
  items.forEach((item, idx) => {
    html += `
      <tr height="22">
        <td class="td-border text-center">${idx + 1}</td>
        <td class="td-border">&nbsp;${item.transaksi}</td>
        <td class="td-border text-center">${item.ukuran || "-"}</td>
        <td class="td-border text-center">${item.quantity}</td>
        <td class="td-border text-right">Rp ${Number(item.unit_price).toLocaleString("id-ID")}&nbsp;</td>
        <td class="td-border text-right">Rp ${Number(item.total).toLocaleString("id-ID")}&nbsp;</td>
      </tr>`;
  });

  // Blok Kotak Ringkasan Total Akuntansi
  html += `
      <tr height="20">
        <td colspan="3"></td>
        <td colspan="2" class="td-border font-bold">&nbsp;Sub Total</td>
        <td class="td-border text-right font-bold">Rp ${Number(po.sub_total).toLocaleString("id-ID")}&nbsp;</td>
      </tr>
      <tr height="20">
        <td colspan="3"></td>
        <td colspan="2" class="td-border font-bold">&nbsp;PPN 11%</td>
        <td class="td-border text-right font-bold">Rp ${Number(po.ppn).toLocaleString("id-ID")}&nbsp;</td>
      </tr>
      <tr height="20">
        <td colspan="3"></td>
        <td colspan="2" class="td-border font-bold" style="background-color: #F2F4F7;">&nbsp;Total</td>
        <td class="td-border text-right font-bold" style="background-color: #F2F4F7;">Rp ${Number(po.total_harga).toLocaleString("id-ID")}&nbsp;</td>
      </tr>
      <tr><td colspan="6"></td></tr>

      <tr>
        <td colspan="3" class="font-bold">Alamat Pengantaran</td>
        <td colspan="3"></td>
      </tr>
      <tr>
        <td colspan="3">PT Peduli Lestari Indonesia</td>
        <td colspan="3" class="text-center font-bold">Bogor, ${new Date().toLocaleDateString("id-ID")}</td>
      </tr>
      <tr>
        <td colspan="3">${po.alamat_pengantaran}</td>
        <td colspan="3" class="text-center">Hormat Kami,</td>
      </tr>
      <tr>
        <td colspan="3">UP Penerima: ${po.penerima_nama}</td>
        <td colspan="3"></td>
      </tr>
      <tr><td colspan="6"></td></tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="3" class="text-center font-bold" style="text-decoration: underline;">Febri</td>
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="3" class="text-center text-muted">HRGA Dept.</td>
      </tr>
    </table></body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PO_${po.nomor_po.replace(/\//g, "-")}.xls`;
  a.click();
};

// =========================================================================
// 5. EXPORT SATUAN LEMBARAN PO TO PDF (Mirip Persis image_97117a.png dengan logo web)
// =========================================================================
export const exportSinglePoToPdf = async (po: any, items: any[]) => {
  if (!po) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  try {
    // Membaca Base64 Logo live dari folder public/logo.png
    const logoBase64 = await loadImageAsBase64("/logo.png");
    doc.addImage(logoBase64, "PNG", 14, 11, 20, 20); 
  } catch (error) {
    console.error("Gagal load logo ke PDF, menggunakan fallback bulatan");
    doc.setFillColor(0, 112, 192);
    doc.circle(24, 22, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold italic");
    doc.setFontSize(8);
    doc.text("Pelestari", 18, 23);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PURCHASE ORDER", 105, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`PO Number : ${po.nomor_po}`, 105, 24, { align: "center" });

  doc.setDrawColor(0, 0, 0);
  doc.line(14, 34, 196, 34);

  // Blok Profil Kiri
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Alamat Perusahaan", 14, 41);
  doc.setFont("helvetica", "normal");
  doc.text("PT Peduli Lestari Indonesia\nNPWP : 0423 0271 5040 4000\nJalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008\nKedung Halang, Bogor Utara, Kota Bogor", 14, 46);

  // Blok Detail Kanan
  doc.setFont("helvetica", "bold");
  doc.text("PO Details :", 125, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`PO Date : ${new Date(po.tanggal_po).toLocaleDateString("id-ID")}\nVendor   : ${po.vendor_nama}\nPIC Hub : ${po.vendor_pic || "-"}\nEmail     : ${po.vendor_email || "-"}`, 125, 46);

  const tableRows = items.map((item, index) => [
    index + 1, item.transaksi, item.ukuran || "-", item.quantity,
    `Rp ${Number(item.unit_price).toLocaleString("id-ID")}`,
    `Rp ${Number(item.total).toLocaleString("id-ID")}`
  ]);

  let finalY = 120;
  
  // Panggil constructor secara langsung agar aman dari error as not a function
  autoTable(doc, {
    startY: 69,
    head: [["No", "Transaksi", "Ukuran", "Quantity", "Unit Price", "Total"]],
    body: tableRows,
    theme: "grid",
    headStyles: { fillColor: [180, 198, 231], textColor: [0, 0, 0], fontStyle: "bold", lineColor: [0, 0, 0], lineWidth: 0.2 },
    bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: { 
  0: { halign: "center", cellWidth: 10 }, 
  2: { halign: "center", cellWidth: 20 }, 
  3: { halign: "center", cellWidth: 18 }, 
  4: { halign: "right", cellWidth: 32 }, 
  5: { halign: "right", cellWidth: 35 } 
},
    didDrawPage: (data: any) => { 
      finalY = data.cursor.y; 
    }
  });

  const nextY = finalY + 6;
  doc.setFont("helvetica", "bold");
  doc.rect(115, nextY, 32, 6); doc.rect(147, nextY, 49, 6);
  doc.text("Sub Total", 117, nextY + 4.3);
  doc.text(`Rp ${Number(po.sub_total).toLocaleString("id-ID")}`, 194, nextY + 4.3, { align: "right" });

  doc.rect(115, nextY + 6, 32, 6); doc.rect(147, nextY + 6, 49, 6);
  doc.text("PPN 11%", 117, nextY + 10.3);
  doc.text(`Rp ${Number(po.ppn).toLocaleString("id-ID")}`, 194, nextY + 10.3, { align: "right" });

  doc.rect(115, nextY + 12, 32, 6); doc.rect(147, nextY + 12, 49, 6);
  doc.text("Total", 117, nextY + 16.3);
  doc.text(`Rp ${Number(po.total_harga).toLocaleString("id-ID")}`, 194, nextY + 16.3, { align: "right" });

  // Susun layout bawah pengiriman & penandatangan
  const bottomY = nextY + 25;
  doc.text("Alamat Pengantaran", 14, bottomY);
  doc.setFont("helvetica", "normal");
  doc.text(`PT Peduli Lestari Indonesia\n${po.alamat_pengantaran}\nPenerima: ${po.penerima_nama}`, 14, bottomY + 5);

  doc.text(`Bogor, ${new Date().toLocaleDateString("id-ID")}\nHormat Kami,`, 145, bottomY + 5);
  doc.setFont("helvetica", "bold"); doc.text("Anisa", 145, bottomY + 25);
  doc.setFont("helvetica", "normal"); doc.text("General Affair", 145, bottomY + 29);

  doc.save(`PO_${po.nomor_po.replace(/\//g, "-")}.pdf`);
};