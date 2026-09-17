"use client"

import React from "react"
import { FileText, ExternalLink } from "lucide-react"
import { useSession } from "next-auth/react"

export default function Page() {
  // Hubungkan komponen dengan session real-time NextAuth
  const { data: session } = useSession()

  const sopList = [
    {
      title: "SOP Human Resource",
      subtitle: "Klik untuk membuka dokumen PDF",
      url: "/docs/sop-penagihan.pdf",
    },
  ]

  return (
    <div className="flex flex-1 flex-col font-sans">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header Dashboard dinamis membaca nama session */}
          <div className="mb-2 px-4 lg:px-6">
            <h1 className="text-xl leading-tight font-bold text-black">
              Dashboard Manajemen Invoice
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Selamat datang kembali,{" "}
              <span className="font-bold text-black">
                {session?.user?.name || "Karyawan PT Pelestari"}
              </span>{" "}
              • Anda masuk sebagai{" "}
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 uppercase">
                {(session?.user as any)?.role || "Staff"}
              </span>
            </p>
          </div>

          {/* === KUMPULAN DOKUMEN SOP (GRID MULTI-CARD) === */}
          <div className="my-2 px-4 lg:px-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {sopList.map((sop, idx) => (
                <a
                  key={idx}
                  href={sop.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block w-full"
                >
                  <div className="flex h-full cursor-pointer items-center justify-between rounded-sm border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-black hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 rounded-sm bg-red-50 p-2.5 text-red-600 transition-colors group-hover:bg-red-100">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="m-0 p-0 text-xs leading-none font-black tracking-tight text-black uppercase">
                          {sop.title}
                        </h3>
                        <p className="mt-1.5 text-[10px] leading-none font-bold tracking-wider text-zinc-400 uppercase">
                          {sop.subtitle}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-black" />
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
