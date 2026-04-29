import { NextResponse } from "next/server";

const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_TEST_PATH = `/kbeauty-ai-tests/write-access-token-secret-${Date.now()}.txt`;

async function readDropboxError(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {
      status: response.status,
      summary: "Empty Dropbox error response."
    };
  }

  try {
    const parsed = JSON.parse(rawText);
    return {
      status: response.status,
      summary:
        parsed?.error_summary ||
        parsed?.error?.error_summary ||
        parsed?.error?.[".tag"] ||
        rawText
    };
  } catch {
    return {
      status: response.status,
      summary: rawText
    };
  }
}

export async function POST() {
  const accessToken = process.env.WRITE_ACCESS_TOKEN_SECRET;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "WRITE_ACCESS_TOKEN_SECRET is missing."
      },
      { status: 500 }
    );
  }

  const fileContents = [
    "K-Beauty AI Dropbox upload verification",
    `timestamp=${new Date().toISOString()}`,
    "source=app/api/dropbox-upload-test"
  ].join("\n");

  const response = await fetch(DROPBOX_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: DROPBOX_TEST_PATH,
        mode: "add",
        autorename: false,
        mute: true,
        strict_conflict: false
      })
    },
    body: Buffer.from(fileContents, "utf8")
  });

  if (response.ok) {
    const data = await response.json();

    return NextResponse.json({
      success: true,
      path: data?.path_display || DROPBOX_TEST_PATH,
      id: data?.id || null,
      name: data?.name || null
    });
  }

  const dropboxError = await readDropboxError(response);

  if (response.status === 401 || response.status === 403) {
    return NextResponse.json(
      {
        success: false,
        error: "Dropbox token or permission issue.",
        detail: dropboxError.summary
      },
      { status: response.status }
    );
  }

  if (response.status === 409) {
    return NextResponse.json(
      {
        success: false,
        error: "Dropbox path conflict issue.",
        detail: dropboxError.summary
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: "Dropbox upload failed.",
      detail: dropboxError.summary
    },
    { status: response.status }
  );
}
