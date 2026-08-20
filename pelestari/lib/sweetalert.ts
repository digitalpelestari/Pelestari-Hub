import Swal from "sweetalert2"

export const swal = {
  success: (text: string) =>
    Swal.fire({
      icon: "success",
      title: "Berhasil",
      text,
      confirmButtonColor: "#1E5631",
      confirmButtonText: "OK",
    }),

  error: (text: string) =>
    Swal.fire({
      icon: "error",
      title: "Gagal",
      text,
      confirmButtonColor: "#DC2626",
      confirmButtonText: "OK",
    }),

  warning: (text: string) =>
    Swal.fire({
      icon: "warning",
      title: "Perhatian",
      text,
      confirmButtonColor: "#D97706",
      confirmButtonText: "OK",
    }),

  info: (text: string) =>
    Swal.fire({
      icon: "info",
      title: "Informasi",
      text,
      confirmButtonColor: "#2563EB",
      confirmButtonText: "OK",
    }),

  confirm: async (text: string): Promise<boolean> => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Apakah Anda Yakin?",
      text,
      showCancelButton: true,
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Ya, Lanjutkan",
      cancelButtonText: "Batal",
    })
    return result.isConfirmed
  },
}
