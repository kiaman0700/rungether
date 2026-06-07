import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    providerToken?: string;
  } | null;
  const providerToken = body?.providerToken?.trim();

  if (!providerToken || providerToken.length > 4096) {
    return NextResponse.json({ unlinked: false }, { status: 400 });
  }

  const response = await fetch("https://kapi.kakao.com/v1/user/unlink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json({ unlinked: false }, { status: response.status });
  }

  return NextResponse.json({ unlinked: true });
}
