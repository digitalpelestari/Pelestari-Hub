/** @type {import('next').NextConfig} */
const nextConfig = {
  // Jangan bundel pdf-parse & pdfjs-dist, biarkan diambil langsung dari
  // node_modules saat runtime — kalau dibundel, pdfjs-dist gagal menemukan
  // file worker-nya (pdf.worker.mjs) dan lempar error "Setting up fake worker failed".
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
}

export default nextConfig