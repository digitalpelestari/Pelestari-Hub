"use server"

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

function buildFileName(prefix: string, originalName: string): string {
  const extension = originalName.split(".").pop() || "jpg"
  return `${prefix}/${prefix.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${extension}`
}

function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || ""
  if (publicDomain && url.startsWith(publicDomain)) {
    return url.substring(publicDomain.length + 1)
  }
  try {
    const u = new URL(url)
    return u.pathname.replace(/^\/+/, "")
  } catch {
    return url.replace(/^https?:\/\/[^/]+\//, "")
  }
}

export async function uploadFileToR2Action(formData: FormData) {
  try {
    const file = formData.get("file") as File
    if (!file) {
      return { success: false, message: "File tidak ditemukan" }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const prefix = (formData.get("prefix") as string) || "cl"
    const fileName = buildFileName(prefix, file.name)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const fileUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`
    return { success: true, url: fileUrl, fileName: file.name }
  } catch (error: any) {
    console.error("R2 Upload Error:", error)
    return { success: false, message: error.message || "Gagal mengunggah file ke Cloudflare" }
  }
}

export async function deleteFileFromR2Action(url: string | null | undefined) {
  try {
    if (!url) return { success: true }
    const key = extractKeyFromUrl(url)
    if (!key) return { success: false, message: "Key tidak valid" }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    )
    return { success: true }
  } catch (error: any) {
    console.error("R2 Delete Error:", error)
    return { success: false, message: error.message || "Gagal menghapus file di Cloudflare" }
  }
}