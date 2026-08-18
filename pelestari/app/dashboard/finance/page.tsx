"use client"

import React from "react"
import { FileText, ExternalLink } from "lucide-react"
import { useSession } from "next-auth/react"

export default function Page() {
  // Hubungkan komponen dengan session real-time NextAuth
  const { data: session } = useSession()

  const sopList = [
    {
      title: "SOP",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-penagihan.pdf",
    },
    {
      title: "SOP Perbendaharaan",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-perbendaharaan.pdf",
    },
    {
      title: "SOP Perpajakan",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-perpajakan.pdf",
    },
  ]

  return (
    <div className="flex flex-1 flex-col font-sans">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          
          {/* Header Dashboard dinamis membaca nama session */}
          <div className="px-4 lg:px-6 mb-2">
            <h1 className="text-xl font-bold text-black leading-tight">
              Dashboard Manajemen Invoice
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
  Selamat datang kembali, <span className="font-bold text-black">{session?.user?.name || "Karyawan PT Pelestari"}</span> • Anda masuk sebagai <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] font-bold uppercase text-zinc-700">{(session?.user as any)?.role || "Staff"}</span>
</p>
          </div>

          {/* === KUMPULAN DOKUMEN SOP (GRID MULTI-CARD) === */}
          <div className="px-4 lg:px-6 my-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sopList.map((sop, idx) => (
                <a 
                  key={idx}
                  href={sop.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full group"
                >
                  <div className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-sm shadow-sm transition-all duration-200 hover:border-black hover:shadow-md cursor-pointer h-full">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-red-50 text-red-600 rounded-sm group-hover:bg-red-100 transition-colors shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-tight text-black m-0 p-0 leading-none">
                          {sop.title}
                        </h3>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1.5 tracking-wider leading-none">
                          {sop.subtitle}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-300 group-hover:text-black transition-colors shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}