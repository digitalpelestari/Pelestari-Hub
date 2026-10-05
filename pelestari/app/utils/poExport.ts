import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// =========================================================================
// 1. HELPER: LOAD IMAGE AS BASE64
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

// Helper: load gambar + ukurannya
const loadImageWithSize = async (url: string) => {
  const base64 = await loadImageAsBase64(url);
  const size = await new Promise<{ width: number; height: number }>(
    (resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 1, height: 1 });
    }
  );
  return { base64, ...size };
};

// =========================================================================
// 2. EXPORT MASSAL DAFTAR REKAP PO TO EXCEL
// =========================================================================
export const exportToExcel = (poList: any[]) => {
  if (poList.length === 0) {
    alert("Tidak ada data PO untuk diexport!");
    return;
  }

  let html = `
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40"
    >

    <head>
      <style>
        table {
          border-collapse: collapse;
          font-family: Arial;
          font-size: 11px;
        }

        .header {
          background-color: #1F4E78;
          color: white;
          font-weight: bold;
          text-align: center;
        }

        .cell {
          border: 1px solid #BFBFBF;
          padding: 5px;
        }

        .text-center {
          text-align: center;
        }

        .text-right {
          text-align: right;
        }
      </style>
    </head>

    <body>

      <h2>PT PEDULI LESTARI INDONESIA</h2>

      <h3>
        Laporan Rekapitulasi Daftar Purchase Order (HRGA)
      </h3>

      <table border="1">

        <tr height="25">
          <th class="header">No</th>
          <th class="header">Nomor PO</th>
          <th class="header">Tanggal</th>
          <th class="header">Vendor Target</th>
          <th class="header">Sub Total</th>
          <th class="header">Total Akhir</th>
          <th class="header">Status</th>
        </tr>
  `;

  poList.forEach((po, index) => {
    html += `
      <tr height="20">

        <td class="cell text-center">
          ${index + 1}
        </td>

        <td class="cell">
          ${po.nomor_po}
        </td>

        <td class="cell text-center">
          ${new Date(po.tanggal_po).toLocaleDateString("id-ID")}
        </td>

        <td class="cell">
          ${po.vendor_nama}
        </td>

        <td class="cell text-right">
          Rp ${Number(po.sub_total).toLocaleString("id-ID")}
        </td>

        <td class="cell text-right">
          Rp ${Number(po.total_harga).toLocaleString("id-ID")}
        </td>

        <td class="cell text-center">
          ${po.status_pembayaran}
        </td>

      </tr>
    `;
  });

  html += `
      </table>

    </body>

    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Rekap_Daftar_PO_${new Date().getFullYear()}.xls`;
  a.click();

  URL.revokeObjectURL(url);
};

// =========================================================================
// 3. EXPORT MASSAL DAFTAR REKAP PO TO PDF
// =========================================================================
export const exportToPdf = (poList: any[]) => {
  if (poList.length === 0) {
    alert("Tidak ada data PO!");
    return;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

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
    po.status_pembayaran,
  ]);

  autoTable(doc, {
    startY: 26,

    head: [
      [
        "No",
        "Nomor PO",
        "Tanggal",
        "Vendor Target",
        "Sub Total",
        "Total Akhir",
        "Status",
      ],
    ],

    body: tableRows,

    theme: "striped",

    headStyles: {
      fillColor: [31, 78, 120],
    },

    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "center" },
    },
  });

  doc.save("Rekap_Daftar_PO.pdf");
};

// =========================================================================
// 4. EXPORT SATUAN PO TO EXCEL
// =========================================================================
export const exportSinglePoToExcel = async (po: any, items: any[]) => {
  if (!po) return;

  const formatTanggal = (v: any) => new Date(v).toLocaleDateString("id-ID");
  const formatRupiah = (v: any) =>
    `Rp ${Number(v || 0).toLocaleString("id-ID")}`;

  // =======================================================================
  // LOGO (lebar 60mm ≈ 227px, sama dengan PDF & print)
  // =======================================================================
  const LOGO_PX_W = 227;

  let logoHtml = "Pelestari";
  let logoPxH = 60;

  try {
    const logo = await loadImageWithSize("/logo-pelestari-baru.png");

    logoPxH = Math.round(LOGO_PX_W / (logo.width / logo.height));

    logoHtml = `
      <img
        src="${logo.base64}"
        width="${LOGO_PX_W}"
        height="${logoPxH}"
      />
    `;
  } catch (e) {
    console.error("Gagal load logo ke excel, menggunakan fallback teks");
  }

  // =======================================================================
  // TTD (lebar 28mm ≈ 106px, muat di kolom paling kanan)
  // =======================================================================
  const TTD_PX_W = 106;

  let ttdHtml = "";
  let ttdPxH = 50;

  try {
    const ttd = await loadImageWithSize("/ttd-anisa.png");

    ttdPxH = Math.round(TTD_PX_W * (ttd.height / ttd.width));

    ttdHtml = `
      <img
        src="${ttd.base64}"
        width="${TTD_PX_W}"
        height="${ttdPxH}"
      />
    `;
  } catch (e) {
    console.warn("Gagal load TTD ke excel, area TTD dikosongkan");
  }

  // Tinggi baris judul mengikuti tinggi logo (logo di kiri, judul di kanan)
  const TITLE_H = 30;
  const PONUM_H = 22;
  const SPACER_H = Math.max(logoPxH - TITLE_H - PONUM_H, 6);

  let html = `
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40"
    >

    <head>

      <meta charset="UTF-8">

      <style>

        table {
          border-collapse: collapse;
          font-family: 'Arial', sans-serif;
          font-size: 11px;
        }

        td {
          vertical-align: middle;
        }

        .title {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
        }

        .po-num {
          font-size: 13px;
          text-align: center;
        }

        .th-baju {
          background-color: #B4C6E7;
          color: #000000;
          font-weight: bold;
          border: 1px solid #000000;
          text-align: center;
        }

        .td-border {
          border: 1px solid #000000;
        }

        .line {
          border-top: 1px solid #000000;
          border-bottom: 1px solid #000000;
          font-size: 1px;
          line-height: 1px;
        }

        .text-center {
          text-align: center;
        }

        .text-right {
          text-align: right;
        }

        .font-bold {
          font-weight: bold;
        }

      </style>

    </head>

    <body>

      <table>

        <colgroup>
          <col width="45">
          <col width="220">
          <col width="85">
          <col width="75">
          <col width="115">
          <col width="125">
        </colgroup>

        <!-- ===================== HEADER: logo kiri, judul kanan ===================== -->

        <tr height="${SPACER_H}">

          <td
            colspan="2"
            rowspan="3"
            align="left"
            valign="top"
          >
            ${logoHtml}
          </td>

          <td colspan="4"></td>

        </tr>

        <tr height="${TITLE_H}">

          <td
            colspan="4"
            class="title"
          >
            PURCHASE ORDER
          </td>

        </tr>

        <tr height="${PONUM_H}">

          <td
            colspan="4"
            class="po-num"
          >
            PO Number : ${po.nomor_po}
          </td>

        </tr>

        <!-- ===================== GARIS GANDA ===================== -->

        <tr height="5">
          <td colspan="6" class="line">&nbsp;</td>
        </tr>

        <tr height="8">
          <td colspan="6"></td>
        </tr>

        <!-- ===================== INFORMASI: kiri = perusahaan, kanan = PO Details (rata kanan) ===================== -->

        <tr>

          <td
            colspan="3"
            class="font-bold"
          >
            Alamat Perusahaan
          </td>

          <td
            colspan="3"
            class="font-bold text-right"
          >
            PO Details
          </td>

        </tr>

        <tr>

          <td colspan="3">
            PT Peduli Lestari Indonesia
          </td>

          <td
            colspan="3"
            class="text-right"
          >
            PO Date : ${formatTanggal(po.tanggal_po)}
          </td>

        </tr>

        <tr>

          <td colspan="3">
            NPWP : 0423 0271 5040 4000
          </td>

          <td
            colspan="3"
            class="text-right"
          >
            Vendor : ${po.vendor_nama || "-"}
          </td>

        </tr>

        <tr>

          <td colspan="3">
            Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008
          </td>

          <td
            colspan="3"
            class="text-right"
          >
            PIC Hub : ${po.vendor_pic || "-"}
          </td>

        </tr>

        <tr>

          <td colspan="3">
            Kedung Halang, Bogor Utara, Kota Bogor
          </td>

          <td
            colspan="3"
            class="text-right"
          >
            Email : ${po.vendor_email || "-"}
          </td>

        </tr>

        <tr height="10">
          <td colspan="6"></td>
        </tr>

        <!-- ===================== TABEL ITEM ===================== -->

        <tr height="25">

          <td class="th-baju" style="width: 45px;">No</td>
          <td class="th-baju" style="width: 220px;">Transaksi</td>
          <td class="th-baju" style="width: 85px;">Ukuran</td>
          <td class="th-baju" style="width: 75px;">Quantity</td>
          <td class="th-baju" style="width: 115px;">Unit Price</td>
          <td class="th-baju" style="width: 125px;">Total</td>

        </tr>
  `;

  items.forEach((item, idx) => {
    html += `
      <tr height="22">

        <td class="td-border text-center">
          ${idx + 1}
        </td>

        <td class="td-border">
          &nbsp;${item.transaksi || "-"}
        </td>

        <td class="td-border text-center">
          ${item.ukuran || "-"}
        </td>

        <td class="td-border text-center">
          ${item.quantity || 0}
        </td>

        <td class="td-border text-right">
          ${formatRupiah(item.unit_price)}&nbsp;
        </td>

        <td class="td-border text-right">
          ${formatRupiah(item.total)}&nbsp;
        </td>

      </tr>
    `;
  });

  html += `
        <tr height="10">
          <td colspan="6"></td>
        </tr>

        <!-- ===================== SUMMARY (rata kanan) ===================== -->

        <tr height="20">

          <td colspan="3"></td>

          <td
            colspan="2"
            class="td-border font-bold"
          >
            &nbsp;Sub Total
          </td>

          <td class="td-border text-right font-bold">
            ${formatRupiah(po.sub_total)}&nbsp;
          </td>

        </tr>

        <tr height="20">

          <td colspan="3"></td>

          <td
            colspan="2"
            class="td-border font-bold"
          >
            &nbsp;PPN 11%
          </td>

          <td class="td-border text-right font-bold">
            ${formatRupiah(po.ppn)}&nbsp;
          </td>

        </tr>

        <tr height="20">

          <td colspan="3"></td>

          <td
            colspan="2"
            class="td-border font-bold"
          >
            &nbsp;Total
          </td>

          <td class="td-border text-right font-bold">
            ${formatRupiah(po.total_harga)}&nbsp;
          </td>

        </tr>

        <tr height="14">
          <td colspan="6"></td>
        </tr>

        <!-- ===================== ALAMAT PENGANTARAN ===================== -->

        <tr>

          <td
            colspan="6"
            class="font-bold"
          >
            Alamat Pengantaran
          </td>

        </tr>

        <tr>

          <td colspan="6">
            PT Peduli Lestari Indonesia
          </td>

        </tr>

        <tr>

          <td colspan="6">
            ${po.alamat_pengantaran || "-"}
          </td>

        </tr>

        <tr>

          <td colspan="6">
            Penerima: ${po.penerima_nama || "-"}
          </td>

        </tr>

        <tr height="14">
          <td colspan="6"></td>
        </tr>

        <!-- ===================== TANDA TANGAN (rata kanan) ===================== -->

        <tr>

          <td colspan="3"></td>

          <td
            colspan="3"
            class="text-right"
          >
            Bogor, ${formatTanggal(new Date())}
          </td>

        </tr>

        <tr>

          <td colspan="3"></td>

          <td
            colspan="3"
            class="text-right"
          >
            Hormat Kami,
          </td>

        </tr>

        <tr height="${ttdPxH + 6}">

          <td colspan="5"></td>

          <td
            align="right"
            valign="top"
          >
            ${ttdHtml}
          </td>

        </tr>

        <tr>

          <td colspan="3"></td>

          <td
            colspan="3"
            class="text-right font-bold"
          >
            Anisa
          </td>

        </tr>

        <tr>

          <td colspan="3"></td>

          <td
            colspan="3"
            class="text-right"
          >
            General Affair
          </td>

        </tr>

      </table>

    </body>

    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `PO_${po.nomor_po.replace(/\//g, "-")}.xls`;
  a.click();

  URL.revokeObjectURL(url);
};

// =========================================================================
// 5. EXPORT SATUAN PO TO PDF
// Layout DISESUAIKAN DENGAN printSinglePo()
// =========================================================================
export const exportSinglePoToPdf = async (po: any, items: any[]) => {
  if (!po) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // =======================================================================
  // KONSTANTA LAYOUT
  // =======================================================================

  const PAGE_W = 210;
  const PAGE_H = 297;

  const MARGIN_X = 14;
  const CONTENT_W = PAGE_W - 14 - 14;

  // Tepi kanan area konten (dipakai untuk PO Details & TTD rata kanan)
  const PAGE_RIGHT = PAGE_W - MARGIN_X; // 196mm

  const formatRupiah = (value: any) => {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
  };

  const formatTanggal = (value: any) => {
    return new Date(value).toLocaleDateString("id-ID");
  };

  // =======================================================================
  // HEADER (LOGO)
  // =======================================================================

  const LOGO_W = 60;
  const LOGO_TOP = -5;

  try {
    const logo = await loadImageWithSize("/logo-pelestari-baru.png");

    const logoH = (logo.height / logo.width) * LOGO_W;

    doc.addImage(logo.base64, "PNG", MARGIN_X, LOGO_TOP, LOGO_W, logoH);
  } catch (error) {
    console.warn("Gagal load logo ke PDF, menggunakan fallback.");

    // Fallback
    doc.setFillColor(0, 112, 192);
    doc.circle(24, 10, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(6);
    doc.text("Pelestari", 19, 12);
  }

  // =======================================================================
  // TITLE
  // =======================================================================

  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);

  doc.text("PURCHASE ORDER", PAGE_W / 2, 38, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(`PO Number : ${po.nomor_po}`, PAGE_W / 2, 43.5, {
    align: "center",
  });

  // =======================================================================
  // GARIS GANDA
  // =======================================================================

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.26);

  doc.line(MARGIN_X, 47, PAGE_RIGHT, 47);
  doc.line(MARGIN_X, 48.2, PAGE_RIGHT, 48.2);

  // =======================================================================
  // INFORMASI
  // Kolom kiri: Alamat Perusahaan (rata kiri)
  // Kolom kanan: PO Details (rata kanan, menempel di pojok kanan)
  // =======================================================================

  const COL_GAP = 12;
  const COL_W = (CONTENT_W - COL_GAP) / 2;

  const LEFT_X = MARGIN_X;

  const INFO_TITLE_Y = 55;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  doc.text("Alamat Perusahaan", LEFT_X, INFO_TITLE_Y);

  doc.text("PO Details", PAGE_RIGHT, INFO_TITLE_Y, { align: "right" });

  // =======================================================================
  // INFO CONTENT
  // =======================================================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.setLineHeightFactor(1.55);

  const companyText = [
    "PT Peduli Lestari Indonesia",
    "NPWP : 0423 0271 5040 4000",
    "Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008",
    "Kedung Halang, Bogor Utara, Kota Bogor",
  ];

  const detailText = [
    `PO Date : ${formatTanggal(po.tanggal_po)}`,
    `Vendor : ${po.vendor_nama || "-"}`,
    `PIC Hub : ${po.vendor_pic || "-"}`,
    `Email : ${po.vendor_email || "-"}`,
  ];

  const companyLines: string[] = companyText.flatMap(
    (line) => doc.splitTextToSize(line, COL_W) as string[]
  );

  const detailLines: string[] = detailText.flatMap(
    (line) => doc.splitTextToSize(line, COL_W) as string[]
  );

  const INFO_CONTENT_Y = 59.5;

  doc.text(companyLines, LEFT_X, INFO_CONTENT_Y);

  doc.text(detailLines, PAGE_RIGHT, INFO_CONTENT_Y, { align: "right" });

  // Tinggi line mengikuti line-height CSS 1.55
  const INFO_LINE_H = 9 * 0.3528 * 1.55;

  const maxInfoLines = Math.max(companyLines.length, detailLines.length);

  const infoBottom = INFO_CONTENT_Y + (maxInfoLines - 1) * INFO_LINE_H;

  // =======================================================================
  // TABLE ITEM
  // =======================================================================

  const tableRows = items.map((item, index) => [
    index + 1,
    item.transaksi || "-",
    item.ukuran || "-",
    item.quantity || 0,
    formatRupiah(item.unit_price),
    formatRupiah(item.total),
  ]);

  const tableStartY = infoBottom + 7;

  autoTable(doc, {
    startY: tableStartY,

    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
    },

    tableWidth: CONTENT_W,

    head: [["No", "Transaksi", "Ukuran", "Quantity", "Unit Price", "Total"]],

    body: tableRows,

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 8.5,

      textColor: [0, 0, 0],

      lineColor: [0, 0, 0],
      lineWidth: 0.26,

      cellPadding: {
        top: 2,
        bottom: 2,
        left: 1.5,
        right: 1.5,
      },

      valign: "middle",
    },

    headStyles: {
      fillColor: [180, 198, 231],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },

    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "right", cellWidth: 32 },
      5: { halign: "right", cellWidth: 35 },
    },
  });

  // =======================================================================
  // POSISI SETELAH TABLE
  // =======================================================================

  let y = (doc as any).lastAutoTable.finalY;

  // =======================================================================
  // SUMMARY
  // =======================================================================

  const SUMMARY_W = 81;
  const SUMMARY_X = PAGE_W - MARGIN_X - SUMMARY_W;

  autoTable(doc, {
    startY: y + 6,

    margin: {
      left: SUMMARY_X,
      right: MARGIN_X,
    },

    tableWidth: SUMMARY_W,

    body: [
      ["Sub Total", formatRupiah(po.sub_total)],
      ["PPN 11%", formatRupiah(po.ppn)],
      ["Total", formatRupiah(po.total_harga)],
    ],

    theme: "grid",

    styles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 9,

      textColor: [0, 0, 0],

      lineColor: [0, 0, 0],
      lineWidth: 0.26,

      fillColor: [255, 255, 255],

      cellPadding: 2,

      valign: "middle",
    },

    columnStyles: {
      0: { cellWidth: 32, halign: "left" },
      1: { cellWidth: 49, halign: "right" },
    },

    didParseCell: (data) => {
      // Baris Total tetap putih seperti print
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.fillColor = [255, 255, 255];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY;

  // =======================================================================
  // ALAMAT PENGANTARAN
  // =======================================================================

  const bottomTop = y + 7;

  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  doc.text("Alamat Pengantaran", MARGIN_X, bottomTop);

  // =======================================================================
  // DELIVERY CONTENT
  // =======================================================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.setLineHeightFactor(1.6);

  const deliveryText = [
    "PT Peduli Lestari Indonesia",
    po.alamat_pengantaran || "-",
    `Penerima: ${po.penerima_nama || "-"}`,
  ];

  const deliveryLines: string[] = deliveryText.flatMap(
    (line) => doc.splitTextToSize(line, CONTENT_W) as string[]
  );

  const DELIVERY_Y = bottomTop + 5;

  doc.text(deliveryLines, MARGIN_X, DELIVERY_Y);

  const DELIVERY_LINE_H = 9 * 0.3528 * 1.6;

  const deliveryBottom =
    DELIVERY_Y + (deliveryLines.length - 1) * DELIVERY_LINE_H;

  // =======================================================================
  // SIGNATURE (rata kanan, menempel di pojok kanan)
  // =======================================================================

  const SIG_TOP = deliveryBottom + 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Tanggal
  doc.text(`Bogor, ${formatTanggal(new Date())}`, PAGE_RIGHT, SIG_TOP, {
    align: "right",
  });

  // Hormat Kami
  doc.text("Hormat Kami,", PAGE_RIGHT, SIG_TOP + 5, { align: "right" });

  // =======================================================================
  // TTD
  // =======================================================================

  const TTD_TOP = SIG_TOP + 4;
  const TTD_W = 28;
  const TTD_X = PAGE_RIGHT - TTD_W; // gambar menempel ke tepi kanan

  let ttdHeight = 28;

  try {
    const ttd = await loadImageWithSize("/ttd-anisa.png");

    ttdHeight = (ttd.height / ttd.width) * TTD_W;

    doc.addImage(ttd.base64, "PNG", TTD_X, TTD_TOP, TTD_W, ttdHeight);
  } catch (error) {
    console.warn("Gagal load TTD ke PDF.");

    // Fallback area agar layout tetap sama
    ttdHeight = 28;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);

    doc.rect(TTD_X, TTD_TOP, TTD_W, 12);
  }

  // =======================================================================
  // NAMA & JABATAN
  // =======================================================================

  const NAME_Y = TTD_TOP + ttdHeight - 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  doc.text("Anisa", PAGE_RIGHT, NAME_Y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("General Affair", PAGE_RIGHT, NAME_Y + 4.5, { align: "right" });

  // =======================================================================
  // SAVE
  // =======================================================================

  doc.save(`PO_${po.nomor_po.replace(/\//g, "-")}.pdf`);
};

// =========================================================================
// 6. PRINT SATUAN LEMBARAN PO
// Layout mengikuti PDF
// =========================================================================
export const printSinglePo = async (po: any, items: any[]) => {
  if (!po) return;

  const printWindow = window.open("", "_blank", "width=900,height=1100");

  if (!printWindow) {
    alert(
      "Popup print diblokir browser. Silakan izinkan popup untuk halaman ini."
    );

    return;
  }

  // =======================================================================
  // FORMAT
  // =======================================================================
  const formatRupiah = (value: any) => {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
  };

  const formatTanggal = (value: any) => {
    return new Date(value).toLocaleDateString("id-ID");
  };

  // =======================================================================
  // LOGO
  // =======================================================================
  let logoSrc = "/logo-pelestari-baru.png";

  try {
    logoSrc = await loadImageAsBase64("/logo-pelestari-baru.png");
  } catch (error) {
    console.warn("Logo tidak dapat dimuat.");
  }

  // =======================================================================
  // TTD
  // =======================================================================
  let ttdSrc = "";

  try {
    ttdSrc = await loadImageAsBase64("/ttd-anisa.png");
  } catch (error) {
    console.warn("TTD tidak dapat dimuat.");
  }

  // =======================================================================
  // TABLE ROWS
  // =======================================================================
  const rows = items
    .map(
      (item, index) => `
        <tr>

          <td class="center">
            ${index + 1}
          </td>

          <td>
            ${item.transaksi || "-"}
          </td>

          <td class="center">
            ${item.ukuran || "-"}
          </td>

          <td class="center">
            ${item.quantity || 0}
          </td>

          <td class="right">
            ${formatRupiah(item.unit_price)}
          </td>

          <td class="right">
            ${formatRupiah(item.total)}
          </td>

        </tr>
      `
    )
    .join("");

  // =======================================================================
  // DOCUMENT
  // =======================================================================
  printWindow.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <meta charset="UTF-8">

      <title>
        PO ${po.nomor_po}
      </title>

      <style>

        @page {
          size: A4 portrait;
          margin: 0;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: white;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 9pt;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 0 14mm 11mm;
          position: relative;
        }

        /* ================================================================
           HEADER
        ================================================================ */

        .header {
          position: relative;
        }

        .header-top {
          position: relative;
        }

        .logo {
          display: block;
          width: 60mm;
          height: auto;
          margin-top: -5mm;
          margin-bottom: 0;
        }

        .title-wrap {
          text-align: center;
          margin-top: -20mm; /* makin negatif = judul makin rapat ke logo */
          margin-bottom: 3mm;
        }

        .title {
          font-size: 15pt;
          font-weight: bold;
          line-height: 1.2;
        }

        .po-number {
          font-size: 10pt;
          line-height: 1.2;
          margin-top: 1mm;
        }

        .line {
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          height: 1.2mm;
          margin-top: 0;
          margin-bottom: 3mm;
        }

        /* ================================================================
           INFORMASI
        ================================================================ */

        .info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 12mm;
          margin-bottom: 4mm;
        }

        .info-title {
          font-weight: bold;
          margin-bottom: 0.5mm;
        }

        .info-content {
          line-height: 1.55;
          white-space: pre-line;
        }

        /* PO Details: rata kanan, menempel di pojok kanan */
        .info-right {
          text-align: right;
        }

        /* ================================================================
           TABLE
        ================================================================ */

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 0;
          font-size: 8.5pt;
        }

        th,
        td {
          border: 1px solid #000;
          padding: 2mm 1.5mm;
          vertical-align: middle;
        }

        th {
          background-color: rgb(180, 198, 231);
          font-weight: bold;
          text-align: center;

          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        th:nth-child(1) {
          width: 10mm;
        }

        th:nth-child(2) {
          width: auto;
        }

        th:nth-child(3) {
          width: 20mm;
        }

        th:nth-child(4) {
          width: 18mm;
        }

        th:nth-child(5) {
          width: 32mm;
        }

        th:nth-child(6) {
          width: 35mm;
        }

        .center {
          text-align: center;
        }

        .right {
          text-align: right;
        }

        /* ================================================================
           SUMMARY
        ================================================================ */

        .summary {
          width: 81mm;
          margin-left: auto;
          margin-top: 6mm;
          border-collapse: collapse;
        }

        .summary td {
          border: 1px solid #000;
          padding: 2mm 2mm;
          font-weight: bold;
        }

        .summary .label {
          width: 32mm;
        }

        .summary .value {
          width: 49mm;
          text-align: right;
        }

        .summary .total {
          background-color: rgb(255, 255, 255);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ================================================================
           ALAMAT PENGANTARAN
        ================================================================ */

        .bottom {
          margin-top: 7mm;
        }

        .delivery-title {
          font-weight: bold;
          margin-bottom: 0.5mm;
        }

        .delivery-content {
          line-height: 1.6;
          white-space: pre-line;
        }

        /* ================================================================
           SIGNATURE
           RATA KANAN, MENEMPEL DI POJOK KANAN
        ================================================================ */

        .signature {
          margin-top: 12mm;
          margin-left: auto;
          width: 50mm;
          line-height: 1.5;
          text-align: right;
        }

        .signature-date {
          margin-bottom: 1mm;
        }

        .signature-greeting {
          margin-bottom: -4mm;
        }

        .signature-image {
          width: 28mm;
          height: auto;
          display: block;
          margin-top: 0;
          margin-left: auto;
          margin-bottom: -8mm;
        }

        .signature-name {
          font-weight: bold;
          font-size: 9pt;
        }

        .signature-position {
          font-size: 9pt;
        }

        /* ================================================================
           PRINT
        ================================================================ */

        @media print {

          html,
          body {
            width: 210mm;
            height: 297mm;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 0 14mm 11mm;
            position: relative;
          }

          th {
            background-color: rgb(180, 198, 231) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .summary .total {
            background-color: rgb(255, 255, 255) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

        }

      </style>

    </head>

    <body>

      <div class="page">

        <!-- ============================================================
             HEADER
        ============================================================ -->

        <div class="header">

          <div class="header-top">
            <img class="logo" src="${logoSrc}" alt="Logo" />
          </div>

          <div class="title-wrap">
            <div class="title">PURCHASE ORDER</div>
            <div class="po-number">PO Number : ${po.nomor_po}</div>
          </div>

        </div>

        <div class="line"></div>

        <!-- ============================================================
             INFORMASI PERUSAHAAN & VENDOR
             (teks HARUS menempel di tag pembuka karena white-space: pre-line)
        ============================================================ -->

        <div class="info">

          <div>

            <div class="info-title">Alamat Perusahaan</div>

            <div class="info-content">PT Peduli Lestari Indonesia
NPWP : 0423 0271 5040 4000
Jalan Raya Jakarta - Bogor Nomor 77 Rt. 001/008
Kedung Halang, Bogor Utara, Kota Bogor</div>

          </div>

          <div class="info-right">

            <div class="info-title">PO Details</div>

            <div class="info-content">PO Date : ${formatTanggal(po.tanggal_po)}
Vendor : ${po.vendor_nama || "-"}
PIC Hub : ${po.vendor_pic || "-"}
Email : ${po.vendor_email || "-"}</div>

          </div>

        </div>

        <!-- ============================================================
             TABLE ITEM
        ============================================================ -->

        <table>

          <thead>

            <tr>

              <th>
                No
              </th>

              <th>
                Transaksi
              </th>

              <th>
                Ukuran
              </th>

              <th>
                Quantity
              </th>

              <th>
                Unit Price
              </th>

              <th>
                Total
              </th>

            </tr>

          </thead>

          <tbody>

            ${rows}

          </tbody>

        </table>

        <!-- ============================================================
             SUMMARY
        ============================================================ -->

        <table class="summary">

          <tr>

            <td class="label">
              Sub Total
            </td>

            <td class="value">
              ${formatRupiah(po.sub_total)}
            </td>

          </tr>

          <tr>

            <td class="label">
              PPN 11%
            </td>

            <td class="value">
              ${formatRupiah(po.ppn)}
            </td>

          </tr>

          <tr>

            <td class="label total">
              Total
            </td>

            <td class="value total">
              ${formatRupiah(po.total_harga)}
            </td>

          </tr>

        </table>

        <!-- ============================================================
             ALAMAT PENGANTARAN
        ============================================================ -->

        <div class="bottom">

          <div class="delivery-title">Alamat Pengantaran</div>

          <div class="delivery-content">PT Peduli Lestari Indonesia
${po.alamat_pengantaran || "-"}
Penerima: ${po.penerima_nama || "-"}</div>

          <!-- ==========================================================
               SIGNATURE
          ========================================================== -->

          <div class="signature">

            <div class="signature-date">
              Bogor, ${formatTanggal(new Date())}
            </div>

            <div class="signature-greeting">
              Hormat Kami,
            </div>

            ${ttdSrc
      ? `
                  <img
                    class="signature-image"
                    src="${ttdSrc}"
                    alt="TTD Anisa"
                  />
                `
      : `
                  <div
                    style="height: 28mm;"
                  ></div>
                `
    }

            <div class="signature-name">
              Anisa
            </div>

            <div class="signature-position">
              General Affair
            </div>

          </div>

        </div>

      </div>

    </body>

    </html>
  `);

  printWindow.document.close();

  // =======================================================================
  // TUNGGU SEMUA GAMBAR SELESAI DIMUAT
  // =======================================================================
  const images = Array.from(printWindow.document.images);

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }

          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );

  // =======================================================================
  // PRINT
  // =======================================================================
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 300);
};