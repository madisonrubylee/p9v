# p9v example — strict blocking and Suspense streaming

The same profile screen (user + stats + posts, each endpoint delayed 400ms),
built several ways:

- `/vanilla/[id]` — the classic **nested component waterfall**: each async
  section awaits its own data before the next one starts. Three 400ms requests
  run back-to-back.
- `/p9v/[id]` — the compatible Resource API combines `defineRouteQuery`,
  `withFragments`, and blocking parallel prefetch.
- `/p9v-streaming/[id]` — the 0.4 TanStack-native contract API uses ordinary
  `queryOptions`/`useSuspenseQuery`, validates component requirements, and lets
  three pending queries stream independently.
- `/client-waterfall/[id]` — three nested browser-side TanStack Query requests
used to demonstrate the p9v Devtools suspected-waterfall timeline.

The example explicitly enables both `<P9vDevtools enabled>` and `<Prefetch
devtools>` so the production build remains demonstrable. Applications should
keep the development-only defaults unless production diagnostics are intended.

## Run

```bash
pnpm install
pnpm build
pnpm start          # http://localhost:3100
```

Open `/p9v/u1` to see a completed blocking Server session,
`/p9v-streaming/u1` to see pending server timings settle through hydration, or
`/client-waterfall/u1` to see a depth-three Client session. The original
`/vanilla/u1` route remains a raw RSC fetch benchmark and is intentionally not
instrumented by the panel.

## Measure

Two benchmarks are included:

```bash
# 1) In-process data-layer benchmark — no server needed.
#    Compares nested requests, correct manual TanStack prefetching, and p9v.
node bench-core.mjs

# 2) Full server-render benchmark — requires `pnpm start` running.
pnpm bench
```

Representative `bench-core.mjs` output (400ms/endpoint):

```
  vanilla (nested waterfall)   1202 ms
  manual TanStack (parallel)     401 ms
  p9v (parallel prefetch)       401 ms

  → Correct manual TanStack and p9v have equivalent parallel performance.
    p9v adds a reusable contract and catches missing prefetches.
```

### Optional: browser LCP with Playwright

```bash
pnpm dlx playwright install chromium
pnpm dlx playwright test
```

> Note: `bench.mjs` and Playwright need a running server. Some sandboxes block
> background servers / `os.networkInterfaces()`; `server.mjs` is a minimal custom
> production server that avoids Next's network-host logging in those cases.
