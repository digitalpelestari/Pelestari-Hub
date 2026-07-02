// A. EXCEL REKAP STANDAR (UNTUK GA)
export const exportAssetToExcelGA = (assetList: any[]) => {
  let html = `<table border="1"><tr style="background-color:#F2F2F2; font-weight:bold;"><th>No</th><th>Nama Asset</th><th>Kode</th><th>Bulan</th><th>Tahun</th><th>Harga Beli</th><th>Perolehan</th><th>Jumlah</th><th>Keterangan</th><th>Kondisi</th></tr>`;
  assetList.forEach((a, i) => {
    html += `<tr><td align="center">${i+1}</td><td>${a.nama_asset}</td><td align="center">${a.kode_asset || "-"}</td><td align="center">${a.bulan_perolehan}</td><td align="center">${a.tahun_perolehan}</td><td align="right">Rp ${Number(a.harga_beli).toLocaleString("id-ID")}</td><td align="center">${a.cara_perolehan}</td><td align="center">${a.jumlah}</td><td>${a.keterangan || "-"}</td><td align="center">${a.kondisi}</td></tr>`;
  });
  html += "</table>";
  downloadExcelBlob(html, "Inventaris_Aset_GA.xls");
};

// B. EXCEL REKAP AKUNTANSI DEPRESIASI KOMPLIT (UNTUK FINANCE)
export const exportAssetToExcelFinance = (assetList: any[]) => {
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><style>
      table { border-collapse: collapse; font-family: Arial; font-size: 11px; }
      .th-header { background-color: #B4C6E7; font-weight: bold; border: 1px solid #000000; text-align: center; }
      .td-border { border: 1px solid #000000; }
    </style></head>
    <body>
    <table border="1">
      <tr>
        <th class="th-header">No</th><th class="th-header">Nama Asset</th><th class="th-header">Kode</th><th class="th-header">Harga Beli</th>
        <th class="th-header">K.Kom</th><th class="th-header">Penyusutan Komersial</th><th class="th-header">K.Fis</th><th class="th-header">Penyusutan Fiskal</th>
        <th class="th-header">Prorata Komersial</th><th class="th-header">Prorata Fiskal</th><th class="th-header">Sisa Nilai Buku</th>
      </tr>`;
  assetList.forEach((a, i) => {
    html += `
      <tr>
        <td class="td-border" align="center">${i+1}</td><td class="td-border">${a.nama_asset}</td><td class="td-border" align="center">${a.kode_asset || "-"}</td><td class="td-border" align="right">Rp ${Number(a.harga_beli).toLocaleString("id-ID")}</td>
        <td class="td-border" align="center">${a.kelompok_komersial}</td><td class="td-border" align="right">Rp ${Number(a.penyusutan_komersial).toLocaleString("id-ID")}</td>
        <td class="td-border" align="center">${a.kelompok_fiskal}</td><td class="td-border" align="right">Rp ${Number(a.penyusutan_fiskal).toLocaleString("id-ID")}</td>
        <td class="td-border" align="right">Rp ${Number(a.prorata_komersial).toLocaleString("id-ID")}</td><td class="td-border" align="right">Rp ${Number(a.prorata_fiskal).toLocaleString("id-ID")}</td>
        <td class="td-border" align="right" style="background-color: #F2F4F7;">Rp ${Number(a.sisa_nilai_buku).toLocaleString("id-ID")}</td>
      </tr>`;
  });
  html += "</table></body></html>";
  downloadExcelBlob(html, "Laporan_Depresiasi_Aset_Finance.xls");
};

function downloadExcelBlob(html: string, fileName: string) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
}