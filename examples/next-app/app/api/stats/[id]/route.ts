import { NextResponse } from "next/server";
import { ENDPOINT_DELAY_MS, sleep } from "../../latency";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await sleep(ENDPOINT_DELAY_MS);
  return NextResponse.json({
    id,
    followers: 4200,
    following: 128,
    contributions: 981,
  });
}
