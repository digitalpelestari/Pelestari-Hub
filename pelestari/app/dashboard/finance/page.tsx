"use client"

import React, { useEffect, useState } from "react"
import { FileText, ExternalLink } from "lucide-react"
import { useSession } from "next-auth/react"

export default function Page() {
  const { data: session } = useSession()
  const [isBlurred, setIsBlurred] = useState(false)

  useEffect(() => {
    // 1. Mencegah Klik Kanan
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    // 2. Mencegah Shortcut Screenshot, Print, dan Inspect Element
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen: kosongkan clipboard
      if (e.key === "PrintScreen") {
        navigator.clipboard.writeText("")
      }

      // Blokir Ctrl+P (Print) / Ctrl+S (Save) / Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }

      // Blokir F12 dan Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault()
      }
    }

    // 3. Auto-Blur saat Snipping Tool / window kehilangan fokus
    const handleBlur = () => setIsBlurred(true)
    const handleFocus = () => setIsBlurred(false)

    document.addEventListener("contextmenu", handleContextMenu)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  const sopList = [
    {
      title: "SOP Penagihan",
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

  const userName = session?.user?.name || "Karyawan PT Pelestari"

  return (
    <div
      className={`relative flex flex-1 flex-col font-sans select-none transition-all duration-150 ${
        isBlurred ? "blur-md pointer-events-none" : ""
      }`}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {/* Overlay Watermark Dinamis */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden opacity-[0.07]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-24 -rotate-12 select-none text-black font-mono text-xs uppercase tracking-widest text-center">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i}>
              <p>{userName}</p>
              <p className="text-[10px]">Confidential Document</p>
            </div>
          ))}
        </div>
      </div>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          
          {/* Header Dashboard */}
          <div className="px-4 lg:px-6 mb-2">
            <h1 className="text-xl font-bold text-black leading-tight">
              Dashboard Manajemen Invoice
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Selamat datang kembali, <span className="font-bold text-black">{userName}</span> • Anda masuk sebagai{" "}
              <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] font-bold uppercase text-zinc-700">
                {(session?.user as any)?.role || "Staff"}
              </span>
            </p>
          </div>

          {/* Kumpulan Dokumen SOP */}
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