// Measures the full server-render time of the vanilla vs p9v routes by fetching
// each page and reading its complete HTML body. No browser needed.
//
// Usage: node bench.mjs            (expects the app running on :3100)
//        BASE=http://localhost:3100 node bench.mjs

const BASE = process.env.BASE ?? "http://localhost:3100";
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const ID = "u1";

async function timeFullResponse(path) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  await res.text(); // drain the entire streamed body
  return performance.now() - start;
}

async function measure(label, path) {
  // one warm-up to avoid first-hit compilation noise
  await timeFullResponse(path);
  const samples = [];
  for (let i = 0; i < ROUNDS; i++) samples.push(await timeFullResponse(path));
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return { label, path, median, samples };
}

const results = [];
results.push(await measure("vanilla (waterfall)", `/vanilla/${ID}`));
results.push(await measure("p9v (parallel)", `/p9v/${ID}`));

const width = Math.max(...results.map((r) => r.label.length));
console.log(`\nFull server-render time (median of ${ROUNDS}):\n`);
for (const r of results) {
  console.log(
    `  ${r.label.padEnd(width)}  ${Math.round(r.median)
      .toString()
      .padStart(5)} ms`,
  );
}
const [vanilla, p9v] = results;
const speedup = (vanilla.median / p9v.median).toFixed(2);
console.log(`\n  → p9v is ${speedup}x faster (${Math.round(vanilla.median - p9v.median)}ms saved)\n`);
