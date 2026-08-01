# Changelog

## 0.3.0

### Added

- Beginner API with `useResource(resource, arg)` and direct `<Prefetch resources>` usage.
- Blocking and RSC Suspense streaming prefetch modes.
- `withFragments` helper for colocated strict fragment metadata.
- Pending-query reuse and streamed server timing settlement in browser Devtools.

### Changed

- Cache readers now distinguish usable data, pending queries, failed queries, and genuine misses.
- Documentation positions p9v as a TanStack Query prefetch correctness layer and compares it honestly with correct manual prefetching.

### Compatibility

- Existing `fragment`, `useFragment`, `Component.fragments`, `defineRouteQuery`, and `<Prefetch query params>` call sites remain supported.
- Blocking remains the default prefetch mode and production keeps its safe fetch fallback.

## 0.2.0

### Added

- Browser `P9vDevtools` panel for server-prefetch and client TanStack Query timing sessions.
- Live suspected-waterfall timeline, critical path, query details, Clear, and CLI-compatible JSON copy.
- Development-only server timing metadata from `<Prefetch>`, with explicit production opt-in.
- Dedicated `@p9v/core/devtools/react` client entry point and interactive Next.js demo.

### Changed

- `WaterfallRecorder` now exposes stable snapshots and subscriptions for reactive consumers.
- Query timings can identify their server/client source, session, route, and stable timing ID.

### Compatibility

- Existing `@p9v/core/devtools` recorder, JSON arrays, and CLI analysis remain compatible.
- General raw RSC `fetch` calls are not instrumented; server timings cover p9v `<Prefetch>` resources.

## 0.1.0

### Added

- Compile-time route completeness checks between `root` resources and component fragments in `includes`.
- Development-time route validation with actionable `P9vRouteConfigError` details.
- Package smoke tests for ESM, CommonJS, type declarations, client directives, and the CLI.
- CI coverage on Node.js 18 and 22.

### Changed

- Resource names retain their string literal types through resources, instances, and fragments.
- Route scope now distinguishes resources actually prefetched by `root` from resources required by included components.
- Package documentation and examples consistently use the `@p9v/core` package name.

### Compatibility

- Existing valid `defineResource`, `fragment`, and `defineRouteQuery` call sites keep the same shape.
- A route whose `includes` require resources absent from `root` now fails type checking. This is an intentional correctness improvement.
- Production keeps the existing non-strict fetch fallback behavior.
