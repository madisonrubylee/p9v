# p9v example — waterfall vs parallel prefetch

The same profile screen (user + stats + posts, each endpoint delayed 400ms),
built two ways:

- `/vanilla/[id]` — the classic **nested component waterfall**: each async
  section awaits its own data before the next one starts. Three 400ms requests
  run back-to-back.
- `/p9v/[id]` — a single `defineRouteQuery` prefetches all three resources **in
  parallel** via `<Prefetch>`; the components read from the hydrated cache with
  `useFragment` and never trigger their own fetches.

## Run

```bash
pnpm install
pnpm build
pnpm start          # http://localhost:3100
```

Open `/vanilla/u1` and `/p9v/u1` and watch the Network tab.

## Measure

Two benchmarks are included:

```bash
# 1) In-process data-layer benchmark — no server needed.
#    Exercises the real p9v resources + QueryClient.prefetchQuery + dehydrate.
node bench-core.mjs

# 2) Full server-render benchmark — requires `pnpm start` running.
pnpm bench
```

Representative `bench-core.mjs` output (400ms/endpoint):

```
  vanilla (nested waterfall)   1202 ms
  p9v (parallel prefetch)       401 ms

  → p9v is 3.00x faster (801ms saved)
```

### Optional: browser LCP with Playwright

```bash
pnpm dlx playwright install chromium
pnpm dlx playwright test
```

> Note: `bench.mjs` and Playwright need a running server. Some sandboxes block
> background servers / `os.networkInterfaces()`; `server.mjs` is a minimal custom
> production server that avoids Next's network-host logging in those cases.
