// app/api/test-db/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.execute("SELECT 1 AS ok");

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      code: e.code,
    });
  }
}