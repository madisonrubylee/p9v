<p align="center">
<img src="./assets/logo.png" alt="p9v logo" width="640" />
</p>

# p9v — Prevent React Query Request Waterfalls

English | [한국어](./README.ko.md)

**A Relay-style data layer for REST, TanStack Query, and the Next.js App Router.**

p9v keeps data requirements next to React components while prefetching every
request in parallel at the route. Undeclared fields become type errors, and
missing prefetches become clear runtime errors instead of hidden waterfalls.

- **Colocate data requirements** with reusable, type-safe fragments
- **Prefetch in parallel** with TanStack Query and React Server Components
- **Prevent regressions** by turning cache misses into actionable errors
- **No GraphQL, code generation, or build plugin required**

```text
vanilla nested fetching   1,202 ms  ██████████████████████████████
p9v parallel prefetch       401 ms  ██████████

3.00× faster · 801 ms saved
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

### 2. Declare what a component reads

```tsx
import { fragment } from "@p9v/core";
import { useFragment } from "@p9v/core/react";

const UserCard_user = fragment(userResource, ["id", "name", "avatarUrl"]);

export function UserCard({ userId }: { userId: string }) {
  const user = useFragment(UserCard_user, userId);

  return <span>{user.name}</span>;
}

UserCard.fragments = [UserCard_user] as const;
```

`user` only exposes the declared fields. Reading `user.email`, for example, is
a TypeScript error.

### 3. Prefetch at the route

```tsx
import { defineRouteQuery } from "@p9v/core";
import { Prefetch } from "@p9v/core/server";

const userPageQuery = defineRouteQuery({
  name: "user-page",
  root: ({ id }: { id: string }) => [userResource(id), statsResource(id)],
  includes: [UserCard, StatsPanel],
});

export default async function Page({ params }) {
  const { id } = await params;

  return (
    <Prefetch query={userPageQuery} params={{ id }}>
      <UserCard userId={id} />
      <StatsPanel userId={id} />
    </Prefetch>
  );
}
```

`<Prefetch>` fetches the route's resources in parallel on the server, then
dehydrates and hydrates the TanStack Query cache. `useFragment` reads that cache;
it never starts an accidental request in development.

## Why p9v?

Component-level fetching is easy to maintain, but nested components can create
serial requests. Moving every request to the route fixes performance while
duplicating each component's data requirements.

p9v keeps both benefits:

| Approach                  | Colocated requirements | Parallel fetching |    Prevents waterfalls    |
| ------------------------- | :--------------------: | :---------------: | :-----------------------: |
| Fetch inside components   |          Yes           |        No         |            No             |
| Manual route prefetching  |           No           |        Yes        |            No             |
| Waterfall detection tools |          Yes           |        No         | No — warns after the fact |
| **p9v**                   |        **Yes**         |      **Yes**      |          **Yes**          |

The model follows three rules:

1. **Declare** fields with `fragment(resource, fields)`.
2. **Mask** component data to those fields.
3. **Enforce** route prefetching when `useFragment` reads the cache.

This brings Relay-style fragment colocation and data masking to REST APIs and
TanStack Query—without adopting GraphQL. It directly addresses the prefetching
and code-colocation trade-off discussed by the
[TanStack Query maintainers](https://github.com/TanStack/query/discussions/8064).

## Find existing React Query waterfalls

The optional devtools record query-cache timings, identify serial requests, and
print the critical path.

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
| `fragment(resource, fields)` | Declare and type-mask a component's fields     |
| `defineRouteQuery(...)`      | List route resources and included components   |
| `useFragment(fragment, arg)` | Reactively read prefetched, masked cache data  |
| `<Prefetch query params>`    | Prefetch, dehydrate, and hydrate route data    |
| `WaterfallRecorder`          | Record and analyze query timing in development |

### Package entry points

| Import               | Environment | Main exports                                       |
| -------------------- | ----------- | -------------------------------------------------- |
| `@p9v/core`          | Server-safe | `defineResource`, `fragment`, `defineRouteQuery`   |
| `@p9v/core/react`    | Client      | `useFragment`, `P9vProvider`, `RouteQueryProvider` |
| `@p9v/core/server`   | Server      | `Prefetch`, `getServerQueryClient`                 |
| `@p9v/core/devtools` | Any         | Recorder, analysis, and reporting utilities        |

## Strict mode

In development, a missing prefetch throws `P9vWaterfallError`. On React 19.1+,
the error also identifies the responsible component through owner stacks.

Production defaults to a safe fetch fallback. To intentionally defer a request,
set `{ defer: true }` on its fragment. You can override strict behavior for a
subtree with `<P9vProvider strict={...}>`.

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
