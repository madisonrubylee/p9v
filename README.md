<p align="center">
<img src="./assets/logo.png" alt="p9v logo" width="640" />
</p>

# p9v — TanStack Query Prefetch Integrity

English | [한국어](./README.ko.md)

**TanStack Query knows how to prefetch. p9v makes sure you didn't forget.**

p9v is a correctness layer for TanStack Query applications. It colocates query
requirements with components, verifies that routes start those exact queries,
and turns accidental browser cache misses into actionable development errors
and CI failures. TanStack Query remains responsible for fetching, caching,
Suspense, dehydration, and hydration.

- Use ordinary `queryOptions`, `useQuery`, and `useSuspenseQuery`
- Catch missing prefetches by contract name at compile time and exact key at runtime
- Start blocking and streaming queries together in Next.js App Router
- Separate prefetched, intentionally deferred, and unexpected requests in Devtools
- Enforce route budgets with `p9v analyze`
- Keep the v0 Resource and fragment APIs when they fit better

## Why use p9v if manual prefetching is just as fast?

p9v does not make a correctly written TanStack Query prefetch faster. It uses
the same TanStack Query primitives, so equivalent runtime performance is the
expected result:

```text
naive nested fetching       1,202 ms
manual TanStack prefetch      401 ms
p9v prefetch                  401 ms
```

The difference appears after the component tree changes. A child component can
add or change a query without updating the route prefetch. Manual prefetching
then regresses silently; p9v rejects the missing contract during development or
CI before it ships.

```text
                                  today     after a missed child query
manual TanStack prefetch          401 ms             802 ms
p9v                               401 ms          CI failure
```

Think of p9v like a type checker for prefetch integrity, not a faster query
client. It is most useful when multiple teams reuse components, route trees are
large, or performance budgets must survive frequent refactors.

For a small application with one or two obvious queries per page, manual
TanStack prefetching may be simpler and p9v may not be necessary. The goal is
to make that trade-off explicit rather than claim a performance advantage that
does not exist.

## Install

```bash
npm install @p9v/core @tanstack/react-query
```

React 18 or 19 and TanStack Query 5 are supported.

## Quick start

### 1. Add identity to ordinary TanStack options

```ts
import { queryOptions } from "@tanstack/react-query";
import { defineQueryContract } from "@p9v/core";

export const userQuery = defineQueryContract({
  name: "user",
  options: (id: string) =>
    queryOptions({
      queryKey: ["user", id] as const,
      queryFn: () => api.get<User>(`/users/${id}`),
    }),
});
```

`defineQueryContract` preserves the TanStack options type. It also supports
`infiniteQueryOptions`; p9v selects `prefetchInfiniteQuery` automatically.

### 2. Colocate the requirement with its consumer

```tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { withQueryRequirements } from "@p9v/core";

export const UserCard = withQueryRequirements(
  [userQuery],
  function UserCard({ userId }: { userId: string }) {
    const { data } = useSuspenseQuery(userQuery(userId));
    return <span>{data.name}</span>;
  },
);
```

The consumer still uses TanStack Query directly. If `userQuery(userId)` is not
in the hydrated cache, development strict mode throws `P9vWaterfallError` with
the exact key instead of silently starting a browser waterfall.

### 3. Define and execute the route contract

```tsx
import { defineRouteContract } from "@p9v/core";
import { Prefetch } from "@p9v/core/server";

export const userPage = defineRouteContract({
  name: "user-page",
  load: ({ id }: { id: string }) => [
    { query: userQuery(id), policy: "blocking" },
    { query: statsQuery(id), policy: "streaming" },
  ],
  includes: [UserCard, StatsPanel],
});

export default async function Page({ params }) {
  const { id } = await params;
  return (
    <Prefetch contract={userPage} params={{ id }}>
      <UserCard userId={id} />
      <StatsPanel userId={id} />
    </Prefetch>
  );
}
```

All entries start before p9v waits. `blocking` entries delay the server
boundary; `streaming` entries are dehydrated with their pending Promise for an
RSC-capable framework such as Next.js App Router. A component requirement
missing from `load` fails TypeScript and development route validation.

If the route loads `userQuery("u1")` while the component reads
`userQuery("u2")`, the exact-key cache miss is still caught at runtime.

## Intentional client queries

Strict contract queries do not begin unexpectedly in the development browser.
Opt in at the contract or call site when a client fetch is intentional:

```ts
const searchQuery = defineQueryContract({
  name: "search",
  defer: true,
  options: (term: string) => queryOptions({ /* ... */ }),
});

useSuspenseQuery(userQuery(id, { defer: true }));
```

Production keeps the safe TanStack fetch fallback. Deferred requests are marked
`intentional-deferred`; missing strict contracts are marked
`unexpected-waterfall`; server route entries are marked `prefetched`.

## Devtools and CI budgets

Mount the panel inside `QueryClientProvider`:

```tsx
import { P9vDevtools } from "@p9v/core/devtools/react";

<QueryClientProvider client={queryClient}>
  <P9vDevtools />
  {children}
</QueryClientProvider>;
```

The panel separates contract-backed classifications from timing-based suspected
waterfalls. Save `WaterfallRecorder.toJSON()` to `p9v.record.json`, then add an
optional `p9v.config.json`:

```json
{
  "maxUnexpectedWaterfalls": 0,
  "maxDepth": 1,
  "maxCriticalPathMs": 500,
  "routes": {
    "dashboard": { "maxCriticalPathMs": 400 }
  }
}
```

```bash
npx p9v analyze
npx p9v analyze artifacts/profile.json --config config/p9v.json
```

The command exits non-zero when a configured global or per-route budget is
exceeded. Without a config it retains the legacy behavior and fails on an
inferred waterfall deeper than one request.

## Existing Resource and fragment APIs

The 0.3 APIs remain supported in 0.4:

```tsx
const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: (id) => fetchUser(id),
});

<Prefetch resources={[userResource(id)]} mode="streaming">
  <UserCard userId={id} />
</Prefetch>;
```

Use `defineResource`/`useResource` for the smallest p9v-owned API, and
`fragment`/`useFragment` when field masking is valuable. See
[the 0.4 adoption guide](./MIGRATION.md); no 0.3 call site has to migrate.

## API and package entry points

| Import | Main APIs |
| --- | --- |
| `@p9v/core` | `defineQueryContract`, `withQueryRequirements`, `defineRouteContract`, legacy Resource/fragment APIs |
| `@p9v/core/react` | `RouteContractProvider`, `P9vProvider`, legacy read hooks |
| `@p9v/core/server` | Next.js/RSC `<Prefetch>`, `getServerQueryClient` |
| `@p9v/core/devtools` | recorder, timing analysis, `evaluateBudgets` |
| `@p9v/core/devtools/react` | browser `P9vDevtools` panel |

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

The included [Next.js example](./examples/next-app) demonstrates blocking,
streaming, and browser waterfall diagnostics.

## License

[MIT](./LICENSE)
