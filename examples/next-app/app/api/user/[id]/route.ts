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
    name: "Ada Lovelace",
    email: "ada@example.com",
    avatarUrl: `https://i.pravatar.cc/80?u=${id}`,
    teamId: "t1",
  });
}
