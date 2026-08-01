# Adopting p9v 0.4

p9v 0.4 is backward compatible with the public 0.3 Resource, fragment, route
query, server Prefetch, and Devtools APIs. Existing applications can upgrade the
package without rewriting call sites.

## Recommended adoption

New code should keep its TanStack Query options and add contracts around them:

1. Wrap an existing options factory with `defineQueryContract`.
2. Attach contract identities with `withQueryRequirements`.
3. Replace route-level manual prefetch lists with `defineRouteContract`.
4. Pass the contract to `<Prefetch contract={route} params={params}>`.
5. Mark queries that intentionally start in the browser with `defer: true`.

```ts
// Before: ordinary options factory
const userOptions = (id: string) => queryOptions({
  queryKey: ["user", id],
  queryFn: () => fetchUser(id),
});

// After: same options and TanStack hooks, with a stable contract identity
const userQuery = defineQueryContract({
  name: "user",
  options: userOptions,
});
```

## Intentional browser fetching

A contract is strict by default in the development browser. Queries used for
search, pagination triggered only by interaction, or other intentional client
work should opt in globally or at one call site:

```ts
defineQueryContract({ name: "search", defer: true, options: searchOptions });
userQuery(id, { defer: true });
```

Production retains a safe fetch fallback even for strict contracts.

## CI configuration

The CLI still fails on an inferred waterfall when no config exists. Adding a
`p9v.config.json` switches it to explicit budgets, including deterministic
`unexpected-waterfall` classifications.
