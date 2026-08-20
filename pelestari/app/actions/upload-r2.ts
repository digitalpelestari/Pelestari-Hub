"use server"

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

export async function uploadFileToR2Action(formData: FormData) {
  try {
    const file = formData.get("file") as File
    if (!file) {
      return { success: false, message: "File tidak ditemukan" }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.name.split(".").pop()
    const fileName = `cl/CL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${extension}`

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