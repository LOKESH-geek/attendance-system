import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/server/mongodb";

export async function GET() {
  try {
    const client = await getMongoClient();

    await client.db(process.env.MONGODB_DB || "attendease").command({
      ping: 1,
    });

    return NextResponse.json({
      success: true,
      message: "MongoDB connected successfully",
    });
  } catch (error) {
    console.error("MongoDB error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "MongoDB connection failed",
      },
      { status: 500 }
    );
  }
}
