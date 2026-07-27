// In-process benchmark of the mechanism p9v changes: a nested-component
// waterfall (sequential awaits) vs p9v's parallel route prefetch. Uses the real
// p9v resource definitions + a real TanStack QueryClient (prefetchQuery +
// dehydrate), so this exercises the actual code path — no server or ports.
//
// Usage: node bench-core.mjs

import { QueryClient, dehydrate } from "@tanstack/react-query";
import { defineResource } from "p9v";

const DELAY_MS = 400;
const ROUNDS = Number(process.env.ROUNDS ?? 7);
const ID = "u1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = {
  user: async (id) => {
    await sleep(DELAY_MS);
    return { id, name: "Ada Lovelace", teamId: "t1", avatarUrl: "", email: "" };
  },
  stats: async (id) => {
    await sleep(DELAY_MS);
    return { id, followers: 4200, following: 128, contributions: 981 };
  },
  posts: async (id) => {
    await sleep(DELAY_MS);
    return { items: [{ id: `${id}-1`, title: "x" }] };
  },
};

const userResource = defineResource({
  name: "user",
  key: (id) => ["user", id],
  fetch: (id) => api.user(id),
});
const statsResource = defineResource({
  name: "stats",
  key: (id) => ["stats", id],
  fetch: (id) => api.stats(id),
});
const postsResource = defineResource({
  name: "posts",
  key: (id) => ["posts", id],
  fetch: (id) => api.posts(id),
});

// Vanilla nested-component waterfall: each section awaits its data before the
// next section renders and starts its own fetch.
async function vanillaWaterfall(id) {
  const t = performance.now();
  await api.user(id);
  await api.stats(id);
  await api.posts(id);
  return performance.now() - t;
}

// p9v: the route prefetches all three resources in parallel, then dehydrates.
async function p9vParallel(id) {
  const t = performance.now();
  const client = new QueryClient();
  await Promise.all(
    [userResource, statsResource, postsResource].map((r) =>
      client.prefetchQuery(r.queryOptions(id)),
    ),
  );
  dehydrate(client);
  return performance.now() - t;
}

async function measure(label, fn) {
  await fn(ID); // warm-up
  const samples = [];
  for (let i = 0; i < ROUNDS; i++) samples.push(await fn(ID));
  samples.sort((a, b) => a - b);
  return { label, median: samples[Math.floor(samples.length / 2)] };
}

const vanilla = await measure("vanilla (nested waterfall)", vanillaWaterfall);
const p9v = await measure("p9v (parallel prefetch)", p9vParallel);

const width = Math.max(vanilla.label.length, p9v.label.length);
console.log(`\nData-layer time (median of ${ROUNDS}, ${DELAY_MS}ms/endpoint):\n`);
for (const r of [vanilla, p9v]) {
  console.log(`  ${r.label.padEnd(width)}  ${Math.round(r.median).toString().padStart(5)} ms`);
}
console.log(
  `\n  → p9v is ${(vanilla.median / p9v.median).toFixed(2)}x faster ` +
    `(${Math.round(vanilla.median - p9v.median)}ms saved)\n`,
);
