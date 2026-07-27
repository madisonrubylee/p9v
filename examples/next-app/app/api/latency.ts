/** Per-endpoint simulated latency (ms). Tune to make the waterfall obvious. */
export const ENDPOINT_DELAY_MS = 400;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
