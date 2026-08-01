<p align="center">
<img src="./assets/logo.png" alt="p9v logo" width="640" />
</p>

# p9v — Prevent React Query Request Waterfalls

English | [한국어](./README.ko.md)

**The prefetch correctness layer for TanStack Query and the Next.js App Router.**

p9v does not invent another way to fetch data. TanStack Query already prefetches
and streams well. p9v connects route prefetches to their consumers so a missing
prefetch becomes an actionable development error instead of a hidden request
waterfall.

- **Start small** with `defineResource`, `useResource`, and `<Prefetch>`
- **Stream pending queries** through React Suspense in RSC applications
- **Prevent regressions** with exact query-key cache-miss errors
- **Opt into stronger contracts** with fragments, masking, and route checks
- **No GraphQL, code generation, or build plugin required**

```text
naive nested fetching       1,202 ms
manual TanStack prefetch      401 ms
p9v prefetch                  401 ms

Correct manual prefetching and p9v have equivalent runtime performance.
p9v adds a reusable contract and catches regressions.
```

Measured in the included [Next.js example](./examples/next-app) with three
400 ms endpoints.

## Install

```bash
npm install @p9v/core @tanstack/react-query
```

Requires React 18 or 19 and TanStack Query 5.

## Quick start

### 1. Define a resource

```ts
import { defineResource } from "@p9v/core";

export const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: (id) => api.get<User>(`/users/${id}`),
});
```

Resource names must be unique within an application.

### 2. Read it in a component

```tsx
import { useResource } from "@p9v/core/react";

export function UserCard({ userId }: { userId: string }) {
  const user = useResource(userResource, userId);
  return <span>{user.name}</span>;
}
```

`useResource` reads the complete value from the hydrated cache. In development,
a genuine cache miss throws `P9vWaterfallError` with the exact query key and
responsible component instead of silently starting a request.

### 3. Prefetch at the route

```tsx
import { Prefetch } from "@p9v/core/server";

export default async function Page({ params }) {
  const { id } = await params;

  return (
    <Prefetch
      resources={[userResource(id), statsResource(id)]}
      name="user-page"
    >
      <UserCard userId={id} />
      <StatsPanel userId={id} />
    </Prefetch>
  );
}
```

The default `mode="blocking"` waits for every resource in parallel. To pass
pending queries to nested Suspense boundaries instead, use streaming mode:

```tsx
<Prefetch resources={[userResource(id)]} mode="streaming">
  <Suspense fallback={<UserCardSkeleton />}>
    <UserCard userId={id} />
  </Suspense>
</Prefetch>
```

Streaming mode requires an RSC framework that can serialize Promises, such as
the Next.js App Router. Blocking remains the portable default.

## Strong contracts when you need them

Fragments add field masking and compile-time route completeness without making
them part of the beginner path:

```tsx
import { defineRouteQuery, fragment, withFragments } from "@p9v/core";
import { useFragment } from "@p9v/core/react";

const UserCard_user = fragment(userResource, ["id", "name", "avatarUrl"]);

export const UserCard = withFragments(
  [UserCard_user],
  function UserCard({ userId }: { userId: string }) {
    const user = useFragment(UserCard_user, userId);
    return <span>{user.name}</span>;
  },
);

const userPageQuery = defineRouteQuery({
  name: "user-page",
  root: ({ id }: { id: string }) => [userResource(id)],
  includes: [UserCard],
});
```

TypeScript verifies that every resource required by `includes` exists in
`root`. `useFragment` exposes only declared fields and applies a development-only
runtime mask. The existing `Component.fragments = [...] as const` syntax remains
supported.

`<Prefetch>` fetches the route's resources in parallel on the server, then
dehydrates and hydrates the TanStack Query cache. `useFragment` reads that cache;
it never starts an accidental request in development.

## Why p9v?

Component-level fetching is easy to maintain, but nested components can create
serial requests. Moving every request to the route fixes performance while
duplicating each component's data requirements.

p9v is the enforcement layer on top of the existing TanStack primitives:

| Approach                  | Colocated requirements | Parallel fetching |      Prevents waterfalls      |
| ------------------------- | :--------------------: | :---------------: | :---------------------------: |
| Fetch inside components   |          Yes           |        No         |              No               |
| Manual TanStack prefetch  |           No           |        Yes        |              No               |
| Waterfall detection tools |          Yes           |        No         |   No — warns after the fact   |
| **p9v**                   |        **Yes**         |      **Yes**      | **Yes, for declared routes** |

The optional strict-contract model follows three rules:

1. **Declare** fields with `fragment(resource, fields)`.
2. **Mask** component data to those fields.
3. **Enforce** resource coverage at route definition and exact query-key
   coverage when `useFragment` reads the cache.

This brings Relay-style fragment colocation and data masking to REST APIs and
TanStack Query—without adopting GraphQL. It directly addresses the prefetching
and code-colocation trade-off discussed by the
[TanStack Query maintainers](https://github.com/TanStack/query/discussions/8064).

## Find existing React Query waterfalls

Mount the browser Devtools once inside your `QueryClientProvider`:

```tsx
import { P9vDevtools } from "@p9v/core/devtools/react";

<QueryClientProvider client={queryClient}>
  <P9vDevtools />
  {children}
</QueryClientProvider>;
```

The floating panel displays p9v `<Prefetch>` server resources and browser-side
TanStack Query requests as separate timing sessions. It shows the suspected
critical path, observed versus parallel time, query keys, and JSON that remains
compatible with the CLI. General raw RSC `fetch` calls are outside its scope.

The panel and server timing collection are enabled by default only in
development. To diagnose an explicitly authorized production session, enable
both sides:

```tsx
<Prefetch query={pageQuery} params={params} devtools>
  {children}
</Prefetch>

<P9vDevtools enabled />
```

The headless recorder remains available for custom integrations:

```ts
import { WaterfallRecorder } from "@p9v/core/devtools";

const recorder = new WaterfallRecorder(queryClient).start();
// Exercise the page, then save recorder.toJSON() as p9v.record.json.
```

```bash
npx p9v analyze
```

```text
[p9v] Waterfall detected — depth 2
      observed 720ms → ~410ms if parallelized

  ▶ UserCard  · user   █████████████████ 300ms
  ▶ UserPosts · team                    ███████████████████████ 410ms
```

The command exits with a non-zero status when it finds a waterfall, so it can run
in CI.

## API overview

| API                          | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `defineResource(...)`        | Define a fetcher, query key, and cache options |
| `useResource(resource, arg)` | Read a complete prefetched resource            |
| `fragment(resource, fields)` | Declare and type-mask a component's fields     |
| `withFragments(...)`         | Attach fragment metadata without a later assignment |
| `defineRouteQuery(...)`      | List route resources and included components   |
| `useFragment(fragment, arg)` | Reactively read prefetched, masked cache data  |
| `<Prefetch ...>`             | Block on or stream direct/route resources      |
| `WaterfallRecorder`          | Record and analyze query timing in development |
| `P9vDevtools`                | Inspect server/client timings in the browser   |
| `P9vRouteConfigError`        | Describe missing route resource prefetches     |

### Package entry points

| Import               | Environment | Main exports                                       |
| -------------------- | ----------- | -------------------------------------------------- |
| `@p9v/core`          | Server-safe | `defineResource`, `fragment`, `withFragments`, `defineRouteQuery` |
| `@p9v/core/react`    | Client      | `useResource`, `useFragment`, `P9vProvider`, `RouteQueryProvider` |
| `@p9v/core/server`   | Server      | `Prefetch`, `getServerQueryClient`                 |
| `@p9v/core/devtools` | Any         | Recorder, analysis, and reporting utilities        |
| `@p9v/core/devtools/react` | Client | Browser `P9vDevtools` panel                         |

## Strict mode

In development, `<Prefetch>` throws `P9vRouteConfigError` before fetching when
an included component's resource is absent from `root`. A cache miss for an
exact query key throws `P9vWaterfallError`; on React 19.1+, that error also
identifies the responsible component through owner stacks.

Production defaults to a safe fetch-and-suspend fallback. To intentionally defer
a request in development, pass `{ defer: true }` to `useResource` or its
fragment. You can override strict behavior for a subtree with
`<P9vProvider strict={...}>`.

Field masking uses a development-only `Proxy`; it adds no production runtime
overhead.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

See the [benchmark and demo instructions](./examples/next-app/README.md) to run
the Next.js example locally.

## Roadmap

- Build-time fragment auto-hoisting
- Sparse REST fieldsets
- Per-item masking for list resources
- Missing-prefetch codemod
- Normalized cache and invalidation graph

## License

[MIT](./LICENSE)
