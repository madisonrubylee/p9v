# Changelog

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
