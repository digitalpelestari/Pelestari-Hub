import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

const pxToExcelColWidth = (px: number) => {
  const mdw = 7;
  return (px - Math.trunc(128 / mdw) * (mdw / 256)) / mdw;
};

async function fetchImageBufferServer(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "";
    const extension = contentType.includes("png") ? "png" : "jpeg";

    return {
      buffer: Buffer.from(arrayBuffer),
      extension: extension as "png" | "jpeg",
    };
  } catch (err) {
    console.error("Gagal download gambar di server:", url, err);
    return null;
  }
}

const isDdtTrue = (val: any) =>
  val === true ||
  val === 1 ||
  String(val).toLowerCase() === "true" ||
  String(val).toLowerCase() === "ya";

async function buildSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: any[],
  batchInfo: any,
  titlePrefix: string
) {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const KTP_SIM_SIZE_PX = { width: 240, height: 153 };
  const PAS_FOTO_MAX_BOX_PX = { width: 124, height: 151 };
  const PADDING_PX = 16;

  const COLS = [
    { header: "No", width: 6 },
    { header: "Nama", width: 26 },
    { header: "Tempat, Tanggal Lahir", width: 26 },
    { header: "Nama Perusahaan", width: 24 },
    { header: "No. NIK", width: 20 },
    { header: "No. SIM", width: 20 },
    { header: "Klasifikasi (Jenis SIM)", width: 16 },
    { header: "Jenis Muatan yang Dibawa Driver", width: 28 },
    { header: "Usia", width: 10 },
    { header: "KTP", width: pxToExcelColWidth(KTP_SIM_SIZE_PX.width + PADDING_PX) },
    { header: "SIM", width: pxToExcelColWidth(KTP_SIM_SIZE_PX.width + PADDING_PX) },
    { header: "Foto", width: pxToExcelColWidth(PAS_FOTO_MAX_BOX_PX.width + PADDING_PX) },
    { header: "Lokasi", width: 18 },
  ];

  COLS.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width;
  });

  const namaBatchTitle = batchInfo?.nama?.toUpperCase() || "SEMUA BATCH";
  const lokasiTitle = batchInfo?.lokasi?.toUpperCase() || "";
  const suffix = titlePrefix ? ` - ${titlePrefix}` : "";

  const formatDateId = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const parts = String(dateStr).split("T")[0].split("-");
    if (parts.length !== 3) return String(dateStr);
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const startDate = formatDateId(batchInfo?.tanggal_mulai);
  const endDate = formatDateId(batchInfo?.tanggal_selesai);
  const dateRange =
    startDate && endDate
      ? `${startDate} s/d ${endDate}`
      : startDate || endDate || "";
  const titleLines = [
    "DAFTAR NAMA PESERTA DIKLAT AWAK ANGKUTAN BARANG BERBAHAYA",
    "DILAKSANAKAN OLEH PT PEDULI LESTARI INDONESIA",
    `TANGGAL PELATIHAN ${namaBatchTitle} ${lokasiTitle}${dateRange ? " " + dateRange : ""}${suffix}`.trim(),
  ];

  titleLines.forEach((text, i) => {
    const rowNum = i + 1;
    sheet.mergeCells(rowNum, 1, rowNum, COLS.length);
    const cell = sheet.getCell(rowNum, 1);
    cell.value = text;
    cell.font = { bold: true, size: i === 0 ? 13 : 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(rowNum).height = i === 0 ? 22 : 18;
  });

  const HEADER_ROW_NUM = 4;
  const headerRow = sheet.getRow(HEADER_ROW_NUM);
  COLS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FF000000" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 30;

  const IDX_KTP = 10;
  const IDX_SIM = 11;
  const IDX_FOTO = 12;
  const IMAGE_ROW_HEIGHT_PT = ((KTP_SIM_SIZE_PX.height + PADDING_PX) * 72) / 96;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = HEADER_ROW_NUM + 1 + idx;
    const dataRow = sheet.getRow(rowNum);

    const values = [
      idx + 1,
      row.nama || "-",
      `${row.tempat_lahir || "-"}, ${row.tanggal_lahir ? String(row.tanggal_lahir).split("T")[0].split("-").reverse().join("-") : "-"}`,
      row.perusahaan || "-",
      row.nik || "-",
      row.nomor_sim || "-",
      row.jenis_sim || "-",
      row.jenis_muatan || "-",
      "-",
      "",
      "",
      "",
      row.lokasi || "-",
    ];

    values.forEach((val, cIdx) => {
      const cell = dataRow.getCell(cIdx + 1);
      cell.value = val;
      cell.alignment = {
        vertical: "middle",
        horizontal: [1, 3, 4, 7].includes(cIdx) ? "left" : "center",
      };
    });
    dataRow.height = IMAGE_ROW_HEIGHT_PT;

    const [imgKtp, imgSim, imgPas] = await Promise.all([
      fetchImageBufferServer(row.foto_ktp),
      fetchImageBufferServer(row.foto_sim),
      fetchImageBufferServer(row.pas_foto),
    ]);

    const rowIndex0 = rowNum - 1;

    if (imgKtp) {
      const id = workbook.addImage({
        buffer: imgKtp.buffer as any,
        extension: imgKtp.extension,
      });
      sheet.addImage(id, {
        tl: { col: IDX_KTP - 1 + 0.05, row: rowIndex0 + 0.05 },
        ext: KTP_SIM_SIZE_PX,
      });
    } else {
      dataRow.getCell(IDX_KTP).value = "-";
    }

    if (imgSim) {
      const id = workbook.addImage({
        buffer: imgSim.buffer as any,
        extension: imgSim.extension,
      });
      sheet.addImage(id, {
        tl: { col: IDX_SIM - 1 + 0.05, row: rowIndex0 + 0.05 },
        ext: KTP_SIM_SIZE_PX,
      });
    } else {
      dataRow.getCell(IDX_SIM).value = "-";
    }

    if (imgPas) {
      const id = workbook.addImage({
        buffer: imgPas.buffer as any,
        extension: imgPas.extension,
      });
      sheet.addImage(id, {
        tl: { col: IDX_FOTO - 1 + 0.1, row: rowIndex0 + 0.05 },
        ext: PAS_FOTO_MAX_BOX_PX,
      });
    } else {
      dataRow.getCell(IDX_FOTO).value = "-";
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data: filteredData, batchInfo } = body;

    if (!filteredData || filteredData.length === 0) {
      return NextResponse.json({ error: "Data kosong" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistem Pelatihan";

    // Kelompokkan: Sheet 1 = ABB (non-DDT), Sheet 2 = AKBB (non-DDT), Sheet 3 = DDT (semua DDT tanpa perdulikan ABB/AKBB)
    const abbRows: any[] = [];
    const akbbRows: any[] = [];
    const ddtRows: any[] = [];

    for (const row of filteredData) {
      const jp = String(row.jenis_pelatihan || "").toUpperCase();
      const ddt = isDdtTrue(row.ddt);

      if (ddt) {
        ddtRows.push(row);
      } else if (jp === "ABB") {
        abbRows.push(row);
      } else if (jp === "AKBB") {
        akbbRows.push(row);
      }
    }

    const orderedGroups: Array<[string, any[]]> = [
      ["ABB", abbRows],
      ["AKBB", akbbRows],
      ["DDT", ddtRows],
    ];

    for (const [name, rows] of orderedGroups) {
      if (rows.length > 0) {
        await buildSheet(workbook, name, rows, batchInfo, name);
      }
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Matrix_Peserta.xlsx"',
      },
    });
  } catch (err: any) {
    console.error("Export Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
