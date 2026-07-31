import * as React from "react";
import { RouteScopeProvider, type RouteScope } from "./context.js";
import type { RouteQuery } from "./routeQuery.js";

/**
 * Client-side provider that advertises which resources the active route
 * prefetched. Purely additive: it makes waterfall errors more specific
 * ("route X does not prefetch Y"). Data still comes from the hydrated cache.
 */
export function RouteQueryProvider<TParams>(props: {
  query: RouteQuery<TParams>;
  params: TParams;
  children: React.ReactNode;
}): React.ReactElement {
  const { query, params, children } = props;

  const scope = React.useMemo<RouteScope>(
    () => ({
      resourceNames: query.getPrefetchedResourceNames(params),
      components: query.includes,
      routeName: query.name,
    }),
    [query, params],
  );

  return React.createElement(RouteScopeProvider, { scope, children });
}
