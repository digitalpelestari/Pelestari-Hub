"use client"

import { useMemo, useState } from "react"

/* ------------------------------------------------------------------ */
/*  Rekonsiliasi Bank — Bentuk Skontro                                 */
/*  Formulir kerja akuntansi, dua kolom sejajar (buku perusahaan vs    */
/*  buku bank), dengan penjumlahan otomatis.                           */
/* ------------------------------------------------------------------ */

type Row = {
  id: string
  label: string
  sub?: string
  value: number
}

const rupiah = (n: number) =>
  n === 0
    ? "-"
    : n.toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      })

function AmountInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value === 0 ? "" : value.toLocaleString("id-ID")}
      placeholder="0"
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "")
        onChange(raw === "" ? 0 : parseInt(raw, 10))
      }}
      className="w-full border-b border-dotted border-[#b7a98d] bg-transparent px-1 py-0.5 text-right font-mono text-[13px] text-[#1c2b3a] tabular-nums transition-colors outline-none placeholder:text-[#c4b9a6] focus:border-[#7a3b2e] focus:bg-[#fbf3e3]"
    />
  )
}

function LineRow({
  row,
  onChange,
}: {
  row: Row
  onChange: (v: number) => void
}) {
  return (
    <div className="grid grid-cols-[1fr,120px] items-start gap-3 py-1 pl-5">
      <div className="text-[13px] leading-snug text-[#2c2116]">
        {row.label}
        {row.sub && (
          <span className="block text-[11px] text-[#8a7b62] italic">
            {row.sub}
          </span>
        )}
      </div>
      <AmountInput value={row.value} onChange={onChange} />
    </div>
  )
}

function SumLine({
  label,
  value,
  emphasis = false,
  double = false,
}: {
  label: string
  value: number
  emphasis?: boolean
  double?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-[1fr,120px] items-baseline gap-3 pt-1 pr-1 pl-5 ${emphasis ? "font-semibold" : ""}`}
    >
      <div className="text-[13px] text-zinc-900">{label}</div>
      <div
        className={`pb-0.5 text-right font-mono text-[13px] text-zinc-900 tabular-nums ${double ? "border-b-4 border-double border-zinc-800" : "border-t border-zinc-800"}`}
      >
        {rupiah(value)}
      </div>
    </div>
  )
}

const mk = (id: string, label: string, sub?: string): Row => ({
  id,
  label,
  sub,
  value: 0,
})

export default function Page() {
  const company = "PT Peduli Lestari Indonesia"
  const period = "periode agustus 2026"

  const [saldoBukuPerusahaan, setSaldoBukuPerusahaan] = useState(0)
  const [saldoBukuBank, setSaldoBukuBank] = useState(0)

  /* ---------------- kolom kiri: buku perusahaan ---------------- */
  const [tambahKiri, setTambahKiri] = useState<Row[]>([
    mk("tk1", "Penyetoran dicatat terlalu kecil", "Selisih"),
    mk("tk2", "Pengambilan dicatat terlalu besar", "Selisih"),
    mk("tk3", "Jasa giro"),
    mk("tk4", "Penagihan piutang oleh bank"),
  ])
  const [kurangKiri, setKurangKiri] = useState<Row[]>([
    mk("kk1", "Penyetoran dicatat terlalu besar", "Selisih"),
    mk("kk2", "Pengambilan dicatat terlalu kecil", "Selisih"),
    mk("kk3", "Beban administrasi bank"),
    mk("kk4", "Pembebanan bank sebagai tanggungan perusahaan"),
    mk("kk5", "Cek tidak cukup dana"),
  ])

  /* ---------------- kolom kanan: buku bank ---------------- */
  const [tambahKanan, setTambahKanan] = useState<Row[]>([
    mk("tb1", "Setoran dalam proses"),
    mk("tb2", "Koreksi pengambilan nasabah dicatat terlalu besar", "Selisih"),
    mk("tb3", "Koreksi penyetoran nasabah dicatat terlalu kecil", "Selisih"),
    mk("tb4", "Koreksi pencatatan merugikan nasabah"),
  ])
  const [kurangKanan, setKurangKanan] = useState<Row[]>([
    mk("kb1", "Cek dalam peredaran", "Selisih"),
    mk("kb2", "Koreksi pengambilan nasabah dicatat terlalu kecil", "Selisih"),
    mk("kb3", "Koreksi pencatatan menguntungkan nasabah"),
  ])

  const sum = (rows: Row[]) => rows.reduce((a, r) => a + r.value, 0)

  const subtotalTambahKiri = sum(tambahKiri)
  const penjumlahanKiri = saldoBukuPerusahaan + subtotalTambahKiri
  const subtotalKurangKiri = sum(kurangKiri)
  const saldoAkhirKiri = penjumlahanKiri - subtotalKurangKiri

  const subtotalTambahKanan = sum(tambahKanan)
  const penjumlahanKanan = saldoBukuBank + subtotalTambahKanan
  const subtotalKurangKanan = sum(kurangKanan)
  const saldoAkhirKanan = penjumlahanKanan - subtotalKurangKanan

  const balanced = useMemo(
    () => saldoAkhirKiri === saldoAkhirKanan && saldoAkhirKiri !== 0,
    [saldoAkhirKiri, saldoAkhirKanan]
  )

  const updateRow =
    (rows: Row[], setRows: (r: Row[]) => void, id: string) => (v: number) =>
      setRows(rows.map((r) => (r.id === id ? { ...r, value: v } : r)))

  const resetAll = () => {
    setSaldoBukuPerusahaan(0)
    setSaldoBukuBank(0)
    setTambahKiri((r) => r.map((x) => ({ ...x, value: 0 })))
    setKurangKiri((r) => r.map((x) => ({ ...x, value: 0 })))
    setTambahKanan((r) => r.map((x) => ({ ...x, value: 0 })))
    setKurangKanan((r) => r.map((x) => ({ ...x, value: 0 })))
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* document sheet */}
      <div className="mx-auto max-w-[920px] bg-white shadow-sm print:shadow-none">
        <div className="rounded-sm border border-zinc-200 p-6 sm:p-8">
          {/* header */}
          <div className="mb-6 text-center font-serif">
            <div className="w-full text-center text-[15px] font-semibold tracking-wide text-zinc-900">
              {company}
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-wide text-zinc-900 uppercase">
              Rekonsiliasi Bank
            </div>
            <div className="mt-1 w-full text-center text-[13px] text-zinc-500 italic">
              {period}
            </div>
          </div>

          {/* two-column table */}
          <div className="grid grid-cols-1 gap-8 font-serif sm:grid-cols-2 sm:gap-10">
            {/* ---------------- LEFT: buku perusahaan ---------------- */}
            <div>
              <div className="grid grid-cols-[1fr,120px] items-baseline gap-3 border-b border-zinc-800 pb-1">
                <div className="text-[13px] font-semibold text-zinc-900">
                  Saldo menurut Pembukuan Perusahaan
                </div>
                <AmountInput
                  value={saldoBukuPerusahaan}
                  onChange={setSaldoBukuPerusahaan}
                />
              </div>

              <div className="mt-3 text-[13px] font-semibold text-zinc-900">
                Ditambah :
              </div>
              {tambahKiri.map((r) => (
                <LineRow
                  key={r.id}
                  row={r}
                  onChange={updateRow(tambahKiri, setTambahKiri, r.id)}
                />
              ))}
              <SumLine label="Subtotal" value={subtotalTambahKiri} double />
              <SumLine label="Penjumlahan" value={penjumlahanKiri} emphasis />

              <div className="mt-4 text-[13px] font-semibold text-zinc-900">
                Dikurangi :
              </div>
              {kurangKiri.map((r) => (
                <LineRow
                  key={r.id}
                  row={r}
                  onChange={updateRow(kurangKiri, setKurangKiri, r.id)}
                />
              ))}
              <SumLine label="Subtotal" value={subtotalKurangKiri} double />

              <div className="mt-4 grid grid-cols-[1fr,120px] items-baseline gap-3 border-t-2 border-zinc-800 pt-2">
                <div className="text-[13px] font-bold text-zinc-900">
                  Saldo setelah rekonsiliasi
                </div>
                <div className="border-b-4 border-double border-zinc-800 pb-0.5 text-right font-mono text-[13px] font-bold text-emerald-600 tabular-nums">
                  {rupiah(saldoAkhirKiri)}
                </div>
              </div>
            </div>

            {/* ---------------- RIGHT: buku bank ---------------- */}
            <div className="border-t border-dashed border-zinc-300 pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-10">
              <div className="grid grid-cols-[1fr,120px] items-baseline gap-3 border-b border-zinc-800 pb-1">
                <div className="text-[13px] font-semibold text-zinc-900">
                  Saldo Menurut Pembukuan Bank
                </div>
                <AmountInput
                  value={saldoBukuBank}
                  onChange={setSaldoBukuBank}
                />
              </div>

              <div className="mt-3 text-[13px] font-semibold text-zinc-900">
                Ditambah :
              </div>
              {tambahKanan.map((r) => (
                <LineRow
                  key={r.id}
                  row={r}
                  onChange={updateRow(tambahKanan, setTambahKanan, r.id)}
                />
              ))}
              <SumLine label="Subtotal" value={subtotalTambahKanan} double />
              <SumLine label="Penjumlahan" value={penjumlahanKanan} emphasis />

              <div className="mt-4 text-[13px] font-semibold text-zinc-900">
                Dikurangi :
              </div>
              {kurangKanan.map((r) => (
                <LineRow
                  key={r.id}
                  row={r}
                  onChange={updateRow(kurangKanan, setKurangKanan, r.id)}
                />
              ))}
              <SumLine label="Subtotal" value={subtotalKurangKanan} double />

              <div className="mt-4 grid grid-cols-[1fr,120px] items-baseline gap-3 border-t-2 border-zinc-800 pt-2">
                <div className="text-[13px] font-bold text-zinc-900">
                  Saldo Setelah rekonsiliasi
                </div>
                <div className="border-b-4 border-double border-zinc-800 pb-0.5 text-right font-mono text-[13px] font-bold text-emerald-600 tabular-nums">
                  {rupiah(saldoAkhirKanan)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
