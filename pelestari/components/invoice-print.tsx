"use client"

export const InvoicePrint = ({ data }: { data: any }) => {
  if (!data) return null

  // Format angka tanpa koma/desimal di belakangnya
  const formatAngka = (amount: number | string) => {
    const num = Number(amount)
    if (isNaN(num)) return "0"
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.trunc(num))
  }

  // Item layanan diambil dari tb_invoice_details (data.items)
  const items: any[] = Array.isArray(data.items) ? data.items : []

  // Subtotal dasar murni
  const subtotalDasar = items.reduce(
    (sum, item) =>
      sum + (Number(item.item_jumlah) || 0) * (Number(item.item_harga) || 0),
    0
  )

  // DPP Nilai Lain (11/12) murni
  const nilaiDppNilaiLain = (11 / 12) * subtotalDasar

  // Pajak & PNBP murni
  const nilaiPPN = data.is_ppn11 === 1 ? subtotalDasar * 0.11 : 0
  const nilaiPPH = data.is_pph23 === 1 ? subtotalDasar * 0.02 : 0
  const nilaiPNBP = data.is_pnbp === 1 ? Number(data.nominal_pnbp) || 0 : 0

  const totalJumlahPeserta = items.reduce(
    (sum, item) => sum + (Number(item.item_jumlah) || 0),
    0
  )

  // Total murni
  const totalMurni =
    data.total !== undefined && data.total !== null
      ? Number(data.total)
      : subtotalDasar + nilaiPPN - nilaiPPH + nilaiPNBP

  let currentNo = 1

  const globalStyle = {
    fontFamily: '"Century Gothic", AppleGothic, sans-serif',
    fontSize: "8.5pt",
    lineHeight: "1.2",
  }

  return (
    <div
      className="print-area relative m-0 w-full bg-white p-4 font-sans text-black"
      style={globalStyle}
    >
      {/* WATERMARK */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <p className="text-5xl font-black tracking-[1.5rem] text-zinc-100 uppercase opacity-40 select-none">
          PT PEDULI LESTARI INDONESIA
        </p>
      </div>

      <div className="relative" style={{ zIndex: 10 }}>
        {/* HEADER */}
        <div className="mb-4 flex items-start justify-between px-10 pt-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-auto w-14 object-contain"
            />
            <div className="font-bold">
              <p className="text-md mb-1 leading-none text-blue-700 uppercase">
                PT Peduli Lestari Indonesia
              </p>
              <p className="text-[7.5pt] leading-none font-normal text-zinc-600 italic">
                Your Best Solution Partner
              </p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-3xl leading-none font-bold tracking-tighter text-blue-700">
              INVOICE
            </h1>
          </div>
        </div>

        {/* INFO ATAS */}
        <div className="mx-10 mb-4 grid grid-cols-12 border border-black shadow-sm">
          <div className="col-span-7 flex min-h-[100px] flex-col justify-between border-r border-black p-3">
            <div>
              <p className="mb-1 text-[8.5pt] font-bold">Kepada Yth,</p>
              <p className="text-[9.5pt] text-zinc-900 uppercase">
                {data.perusahaan_tujuan}
              </p>
              {data.npwp && data.npwp !== "-" && (
                <div className="pt-2 text-[8.5pt]">
                  <p className="font-bold text-zinc-800">
                    NPWP :{" "}
                    <span className="font-mono font-medium">{data.npwp}</span>
                  </p>
                </div>
              )}
              <div className="mt-3 text-[8.5pt] text-zinc-700">
                <p className="leading-tight whitespace-pre-wrap uppercase">
                  {data.alamat_perusahaan}
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-5 bg-zinc-50/50 p-3 text-[8.5pt]">
            <div className="mb-1 flex justify-end text-end font-medium">
              <p>
                <span className="font-bold">Nomor</span>
                <br />
                <span>{data.nomor_invoice}</span>
              </p>
            </div>
            <div className="mb-1 flex justify-end text-end font-medium">
              <p>
                <span className="font-bold">Tanggal</span>
                <br />
                <span>{data.tanggal}</span>
              </p>
            </div>
            <div className="flex justify-end text-end font-medium">
              <p>
                <span className="font-bold">Jatuh tempo</span>
                <br />
                <span>{data.tanggal_jatuh_tempo}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 mb-6 px-10">
          <p className="text-[10pt]">
            Dengan hormat, bersama ini kami sampaikan tagihan atas
            {data.jenis_kegiatan === "konsultan" ? (
              <span>
                {` ${items
                  .map((it) => it.item_deskripsi)
                  .filter(Boolean)
                  .join(" dan ")}`}
              </span>
            ) : (
              " pelaksanaan kegiatan pelatihan"
            )}{" "}
            yang diselenggarakan oleh PT Peduli Lestari Indonesia, sebagai
            rincian dibawah ini:
          </p>
        </div>

        {/* TABEL TAGIHAN UTAMA */}
        <div className="px-10">
          <table className="w-full border border-blue-600 text-[8pt]">
            <thead>
              <tr className="bg-[#0170c0] text-[8pt] text-white">
                <th className="w-[35px] border-r border-[#0170c0] px-1 py-1.5 text-center font-bold">
                  No
                </th>
                <th className="border-r border-[#0170c0] px-3 py-1.5 text-left font-bold">
                  Keterangan
                </th>
                <th className="w-[70px] border-r border-[#0170c0] px-1 py-1.5 text-center font-bold">
                  Jumlah
                </th>
                <th className="w-[120px] border-r border-[#0170c0] px-3 py-1.5 text-center font-bold">
                  Harga
                </th>
                <th className="w-[140px] border-r border-[#0170c0] px-3 py-1.5 text-center font-bold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {/* BARIS LAYANAN */}
              {items.length > 0 ? (
                items.map((item, idx) => {
                  const jumlah = Number(item.item_jumlah) || 0
                  const harga = Number(item.item_harga) || 0
                  return (
                    <tr
                      key={item.id ?? idx}
                      className={`border-[#0170c0] ${idx % 2 === 1 ? "bg-zinc-50/30" : ""}`}
                    >
                      <td className="border-r border-[#0170c0] py-2 text-center">
                        {currentNo++}
                      </td>
                      <td className="border-r border-[#0170c0] px-3 py-2 font-medium uppercase">
                        {item.item_deskripsi || "-"}
                      </td>
                      <td className="border-r border-[#0170c0] py-2 text-center">
                        {jumlah}
                      </td>
                      <td className="border-r border-[#0170c0] px-3 py-2">
                        <div className="flex justify-between">
                          <span>Rp</span>
                          <span>{formatAngka(harga)}</span>
                        </div>
                      </td>
                      <td className="flex justify-between px-3 py-2">
                        <span>Rp</span>
                        {formatAngka(jumlah * harga)}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr className="border-[#0170c0]">
                  <td
                    colSpan={5}
                    className="py-3 text-center text-zinc-400 italic"
                  >
                    Tidak ada rincian layanan
                  </td>
                </tr>
              )}

              {/* PNBP */}
              {data.is_pnbp === 1 && (
                <tr className="border-[#0170c0] bg-zinc-50/30">
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    {currentNo++}
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 font-medium uppercase">
                    PNBP
                  </td>
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    {totalJumlahPeserta}
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2">
                    <div className="flex justify-between">
                      <span>Rp</span>
                      <span>600.000</span>
                    </div>
                  </td>
                  <td className="flex justify-between px-3 py-2">
                    <span>Rp</span> {formatAngka(nilaiPNBP)}
                  </td>
                </tr>
              )}

              {/* DPP NILAI LAIN (PENCATATAN SAJA, TIDAK MASUK TOTAL) */}
              {data.is_dpp === 1 && (
                <tr className="border-[#0170c0] bg-zinc-50/30">
                  <td className="border-r border-[#0170c0] py-2 text-center text-zinc-400">
                    {currentNo++}
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 font-medium">
                    Dasar Pengenaan Pajak
                  </td>
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    -
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 text-center">
                    -
                  </td>
                  <td className="flex justify-between px-3 py-2 font-medium">
                    <span>Rp</span>
                    {formatAngka(nilaiDppNilaiLain)}
                  </td>
                </tr>
              )}

              {/* PPN */}
              {data.is_ppn11 === 1 && (
                <tr className="border-[#0170c0] bg-zinc-50/30">
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    {currentNo++}
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 font-medium uppercase">
                    PPN
                  </td>
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    -
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 text-center">
                    -
                  </td>
                  <td className="flex justify-between px-3 py-2">
                    <span>Rp</span>
                    {formatAngka(nilaiPPN)}
                  </td>
                </tr>
              )}

              {/* PPH 23 */}
              {data.is_pph23 === 1 && (
                <tr className="border-[#0170c0] bg-zinc-50/30">
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    {currentNo++}
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 font-medium uppercase">
                    PPH 23
                  </td>
                  <td className="border-r border-[#0170c0] py-2 text-center">
                    -
                  </td>
                  <td className="border-r border-[#0170c0] px-3 py-2 text-center">
                    -
                  </td>
                  <td className="flex justify-between px-3 py-2">
                    <span>Rp</span> ({formatAngka(nilaiPPH)})
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#0170c0] text-[8pt] font-bold text-white">
                <td
                  colSpan={4}
                  className="border-r border-[#0170c0] px-3 py-2 text-right"
                >
                  Total Tagihan
                </td>
                <td className="flex justify-between px-3 py-2">
                  <span>Rp</span> {formatAngka(totalMurni)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* FOOTER KETENTUAN */}
        <div className="mb-6 px-10 text-[10pt]">
          {data.jenis_kegiatan !== "konsultan" && (
            <p>
              Apabila sesuai ketentuan perpajakan pengguna jasa wajib melakukan
              pemotongan PPh Pasal 23, maka pemotongan dilakukan dari{" "}
              <b>nilai jasa tanpa memperhitungkan PNBP</b> dan Bukti Potong agar
              dikirimkan kepada kami
            </p>
          )}
        </div>

        <div className="mb-6 px-10 text-[10pt]">
          {data.jenis_kegiatan === "pelatihan" && data.is_ppn11 === 0 && (
            <p className="mb-4 text-[10pt]">
              Transaksi ini tidak dikenakan PPN karena termasuk jasa pendidikan
              sesuai pasal 4A ayat (3b) UU PPN
            </p>
          )}
        </div>

        {/* METODE TRANSFER */}
        <div className="mb-6 px-10 text-[10pt]">
          {data.metode_pembayaran === "va" ? (
            <>
              <p className="mb-0.5">
                Pembayaran dilakukan dengan transfer ke :
              </p>
              <p className="mt-0.5">
                Virtual Account BCA:{" "}
                <span className="font-mono font-bold">
                  {data.va_nomor || "-"}
                </span>
              </p>
              <p className="mt-0.5">PT Peduli Lestari Indonesia</p>
            </>
          ) : (
            <>
              <p className="mb-0.5">
                Pembayaran dilakukan dengan transfer ke :
              </p>
              <p className="leading-none">Bank BCA KCP Raya Baru</p>
              <p className="mt-0.5">PT Peduli Lestari Indonesia</p>
              <p className="mt-0.5">Nomor rekening : 8720792894</p>
            </>
          )}
        </div>

        {/* PARAGRAF PENUTUP */}
        <div className="mb-4 px-10 text-[10pt] leading-normal">
          {data.metode_pembayaran === "va" ? (
            <p>
              Demikian <i>invoice</i> ini kami sampaikan. Pembayaran dilakukan
              melalui <i>Virtual Account</i> yang tercantum dan tidak melalui
              rekening bank perusahaan. Apabila VA telah melewati batas waktu
              pembayaran, penerbitan VA baru akan dikenakan biaya administrasi
              sesuai ketentuan. Mohon melakukan konfirmasi setelah pembayaran
              berhasil dilakukan. Terima kasih atas perhatian dan kerja samanya.
            </p>
          ) : (
            <p>
              Demikian <span className="italic">invoice</span> ini kami sampaikan.
              Besar harapan kami agar pembayaran dapat diproses pada kesempatan
              pertama sebelum jatuh tempo. Mohon dapat melakukan konfirmasi
              setelah melakukan pembayaran. Atas perhatian dan kerja sama
              Bapak/Ibu, kami ucapkan terimakasih.
            </p>
          )}
        </div>

        {/* TANDA TANGAN */}
        <div className="flex justify-end px-10 pt-2">
          <div className="w-[180px] text-center">
            <p className="mt-6 mb-24 text-[10pt]">Hormat Kami,</p>
            <p className="text-[10pt] font-bold">Merlyn Yulianti Marpaung</p>
            <p className="text-[10pt] leading-none font-medium">
              Manager Keuangan
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 w-full bg-white py-2 text-center text-[7pt] font-bold tracking-tighter text-blue-600">
        <p>
          Jalan Raya Jakarta Bogor No 77 - Kedunghalang, Kota Bogor 16158 <br />{" "}
          Phone : (0251) 2025 818 WA: 081255556237 Email : ptpelestari@gmail.com
          IG : ptpelestari
        </p>
      </div>
    </div>
  )
}