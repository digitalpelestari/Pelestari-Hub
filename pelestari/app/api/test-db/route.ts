import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [rows]: any = await db.execute(
    "SELECT * FROM tb_login LIMIT 1"
  );

  return NextResponse.json(rows);
}