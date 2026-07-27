import { NextResponse } from "next/server";
import { ENDPOINT_DELAY_MS, sleep } from "../../latency";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await sleep(ENDPOINT_DELAY_MS);
  return NextResponse.json({
    items: [
      { id: `${id}-1`, title: "Notes on the Analytical Engine" },
      { id: `${id}-2`, title: "On computable numbers" },
      { id: `${id}-3`, title: "Loops, before they were cool" },
    ],
  });
}
