"use client";

import React from "react";

export const InvoicePrint = ({ data }: { data: any }) => {
  if (!data) return null;

  const formatNumber = (amount: number) => {
    return new Intl.NumberFormat('id-ID').format(amount || 0);
  }

  const totalItem1 = data.jumlah_peserta * data.harga_peserta;
  const totalItem2 = (data.jumlah_peserta_2 || 0) * (data.harga_peserta_2 || 0);
  const subtotalDasar = totalItem1 + totalItem2;

  const nilaiPPN = data.is_ppn11 === 1 ? subtotalDasar * 0.11 : 0;
  const nilaiPPH = data.is_pph23 === 1 ? subtotalDasar * 0.02 : 0;
  const nilaiPNBP = data.is_pnbp === 1 ? (data.nominal_pnbp || 0) : 0;

  let currentNo = 1;

  const globalStyle = {
    fontFamily: '"Century Gothic", AppleGothic, sans-serif',
    fontSize: '8.5pt', // Ukuran font global diperkecil
    lineHeight: '1.2'
  };

  return (
    <div className="print-area relative bg-white text-black font-sans p-4 m-0 w-full" style={globalStyle}>
      
      {/* WATERMARK */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <p className="text-zinc-100 font-black text-5xl uppercase tracking-[1.5rem] opacity-40 select-none">
          PT PEDULI LESTARI INDONESIA
        </p>
      </div>

      <div className="relative" style={{ zIndex: 10 }}>
        {/* HEADER */}
        <div className="flex justify-between items-start mb-4 pt-4 px-10">
          <div className="flex items-center gap-3">
            <img src="/logo_pelestari.png" alt="Logo" className="w-14 h-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="font-bold">
              <p className="text-md text-blue-700 leading-none mb-1 uppercase">PT Peduli Lestari Indonesia</p>
              <p className="text-[7.5pt] font-normal italic text-zinc-600 leading-none">Your Best Solution Partner</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold text-blue-700 tracking-tighter leading-none">INVOICE</h1>
          </div>
        </div>

        {/* INFO ATAS (DINAMIS KEPADA PERUSAHAAN TUJUAN & NPWP-NYA) */}
        <div className="grid grid-cols-12 border border-black mb-4 mx-10 shadow-sm">
          {/* Bagian Kiri */}
          <div className="col-span-7 p-3 min-h-[100px] border-r border-black flex flex-col justify-between">
            <div>
              <p className="font-bold mb-1 text-[8.5pt]">Kepada Yth,</p>
              <p className="font-bold uppercase text-[9.5pt] text-zinc-900">{data.perusahaan_tujuan}</p>
              {data.npwp && data.npwp !== "-" && (
              <div className="pt-2 border-t border-zinc-100 text-[8.5pt]">
                <p className="font-bold text-zinc-800">NPWP : <span className="font-mono font-medium">{data.npwp}</span></p>
              </div>
            )}
              <div className="mt-3 text-[8.5pt] text-zinc-700">
                <p className="whitespace-pre-wrap uppercase leading-tight">{data.alamat_perusahaan}</p>
              </div>
            </div>
            {/* AMBIL DATA NPWP SECARA DINAMIS DARI DATABASE */}
            
          </div>

          {/* Bagian Kanan */}
          <div className="col-span-5 p-3 text-[8.5pt] bg-zinc-50/50">
            <div className="flex justify-end text-end mb-1 font-medium">
              <p>
                <span className="font-bold">Nomor</span><br/>
                <span>{data.nomor_invoice}</span>
              </p>
            </div>
            <div className="flex justify-end text-end mb-1 font-medium">
              <p>
                <span className="font-bold">Tanggal</span><br/>
                <span>{data.tanggal}</span>
              </p>
            </div>
            <div className="flex justify-end text-end font-medium">
              <p>
                <span className="font-bold">Jatuh tempo</span><br/>
                <span>{data.tanggal_jatuh_tempo}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="px-10 mb-6 mt-6">
          <p className="text-[8pt]">
            Dengan hormat, bersama ini kami sampaikan tagihan atas 
            {data.jenis_kegiatan === 'konsultan' ? (
              <span>
                {` ${data.keterangan}${data.keterangan_2 && data.keterangan_2 !== "-" ? ` dan ${data.keterangan_2}` : ""}`}
              </span>
            ) : (
              " pelaksanaan kegiatan pelatihan"
            )} yang diselenggarakan oleh PT Peduli Lestari Indonesia, sebagai rincian dibawah ini:
          </p>
        </div>

        {/* TABEL */}
        <div className="px-10 mb-6">
          <table className=" border border-blue-600 w-full text-[8pt]">
            <thead>
              <tr className="bg-blue-600 text-white  text-[8pt]">
                <th className="py-1.5 px-1 w-[35px] border-r border-blue-600 font-bold text-center">No</th>
                <th className="py-1.5 px-3 text-left border-r border-blue-600 font-bold">Keterangan</th>
                <th className="py-1.5 px-1 text-center w-[70px] border-r border-blue-600 font-bold">Jumlah</th>
                <th className="py-1.5 px-3 text-center w-[120px] border-r border-blue-600 font-bold">Harga</th>
                <th className="py-1.5 px-3 text-right w-[140px] border-r border-blue-600 font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {/* BARIS 1 */}
              <tr className=" border-blue-600">
                <td className="py-2 text-center border-r border-blue-600">{currentNo++}</td>
                <td className="py-2 px-3 font-medium border-r border-blue-600">{data.keterangan}</td>
                <td className="py-2 text-center border-r border-blue-600">{data.jumlah_peserta}</td>
                <td className="py-2 px-3 border-r border-blue-600">
                  <div className="flex justify-between"><span>Rp</span><span>{formatNumber(data.harga_peserta)}</span></div>
                </td>
                <td className="py-2 px-3 flex justify-between"><span>Rp</span>{formatNumber(totalItem1)}</td>
              </tr>

              {/* BARIS 2 */}
              {data.keterangan_2 && data.keterangan_2 !== "-" && (
                <tr className="bg-zinc-50/30  border-blue-600">
                  <td className="py-2 text-center border-r border-blue-600">{currentNo++}</td>
                  <td className="py-2 px-3 font-medium uppercase border-r border-blue-600">{data.keterangan_2}</td>
                  <td className="py-2 text-center border-r border-blue-600">{data.jumlah_peserta_2}</td>
                  <td className="py-2 px-3 border-r border-blue-600">
                    <div className="flex justify-between"><span>Rp</span> <span>{formatNumber(data.harga_peserta_2)}</span></div>
                  </td>
                  <td className="py-2 px-3 flex justify-between "><span>Rp</span>{formatNumber(totalItem2)}</td>
                </tr>
              )}

              {/* PPH */}
              {data.is_pph23 === 1 && (
                <tr className=" border-blue-600">
                  <td className="py-2 text-center border-r border-blue-600">{currentNo++}</td>
                  <td className="py-2 px-3 font-medium uppercase border-r border-blue-600">PPH 23</td>
                  <td className="py-2 text-center border-r border-blue-600">-</td>
                  <td className="py-2 px-3 border-r border-blue-600 text-center">-</td>
                  <td className="py-2 px-3 flex justify-between"><span>Rp</span> ({formatNumber(nilaiPPH)})</td>
                </tr>
              )}

              {/* PPN */}
              {data.is_ppn11 === 1 && (
                <tr className="bg-zinc-50/30 border-blue-600">
                  <td className="py-2 text-center border-r border-blue-600">{currentNo++}</td>
                  <td className="py-2 px-3 font-medium uppercase border-r border-blue-600">PPN 11%</td>
                  <td className="py-2 text-center border-r border-blue-600">-</td>
                  <td className="py-2 px-3 border-r border-blue-600 text-center">-</td>
                  <td className="py-2 px-3 flex justify-between"><span>Rp</span>{formatNumber(nilaiPPN)}</td>
                </tr>
              )}

              {/* PNBP */}
              {data.is_pnbp === 1 && (
                <tr className="border-b border-blue-600">
                  <td className="py-2 text-center border-r border-blue-600">{currentNo++}</td>
                  <td className="py-2 px-3 font-medium uppercase border-r border-blue-600">PNBP</td>
                  <td className="py-2 text-center border-r border-blue-600">{data.jumlah_peserta + (data.jumlah_peserta_2 || 0)}</td>
                  <td className="py-2 px-3 border-r border-blue-600">
                    <div className="flex justify-between"><span>Rp</span><span>600.000</span></div>
                  </td>
                  <td className="py-2 px-3 flex justify-between"><span>Rp</span> {formatNumber(nilaiPNBP)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-600 text-white font-bold text-[8pt]">
                <td colSpan={4} className="py-2 px-3 text-right border-r border-blue-600">Total</td>
                <td className="py-2 px-3 flex justify-between "> <span>Rp</span> {formatNumber(data.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-10 text-[8pt] mb-6 ">
          {data.jenis_kegiatan === 'pelatihan' && data.is_ppn11 === 0 && (
            <p className="mb-4 text-[8pt]">
              Transaksi ini tidak dikenakan PPN karena termasuk jasa pendidikan sesuai pasal 4A ayat (3b) UU PPN
            </p>
          )}
        </div>

        <div className="px-10 text-[8pt] mb-6 ">
          <p className="mb-0.5">Pembayaran dilakukan dengan transfer ke :</p>
          <p className="leading-none">Bank BCA KCP Raya Baru</p>
          <p className="mt-0.5">PT Peduli Lestari Indonesia</p>
          <p className="mt-0.5">Nomor rekening : 8720792894</p>
        </div>

        <div className="px-10 text-[8pt] mb-4 leading-normal">
          <p>Demikian <span className="italic">invoice</span> ini kami sampaikan. Besar harapan kami agar pembayaran dapat diproses pada kesempatan pertama sebelum jatuh tempo. Mohon dapat melakukan konfirmasi setelah melakukan pembayaran. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terimakasih</p>
        </div>

        <div className="px-10 flex justify-end pt-2">
          <div className="text-center w-[180px]">
            <p className="font-bold mb-16 text-[8pt]">Hormat Kami,</p>
            <p className="font-bold text-[8pt]">Maya Lukita</p>
            <p className="font-medium text-[8pt] leading-none">Direktur</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 w-full text-center text-[7pt] text-blue-600 py-2 bg-white  font-bold tracking-tighter">
        <p>Jalan Raya Jakarta Bogor No 77 - Kedunghalang, Kota Bogor 16158 <br /> Phone : (0251) 2025 818 WA: 081255556237 Email : ptpelestari@gmail.com IG : ptpelestari</p>
      </div>
    </div>
  )
}