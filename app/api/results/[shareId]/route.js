import { NextResponse } from "next/server";
import { getAnalysisResultForShare } from "@/lib/analysis-result-access";

export async function GET(request, { params }) {
  try {
    const shareId = params?.shareId;

    if (!shareId) {
      return NextResponse.json(
        { success: false, error: "Share id is required." },
        { status: 400 }
      );
    }

    const result = await getAnalysisResultForShare({ shareId, request });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Result not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[api/results/:shareId] read failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load result."
      },
      { status: 500 }
    );
  }
}
