import * as React from "react";
import { RouteScopeProvider, type RouteScope } from "./context.js";
import type { RouteQuery } from "./routeQuery.js";
import type { RouteContract } from "./routeContract.js";
import { readP9vQueryMetadata } from "./metadata.js";

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
      queryHashes: new Set(),
      queryContractNames: new Set(),
      components: query.includes,
      routeName: query.name,
    }),
    [query, params],
  );

  return React.createElement(RouteScopeProvider, { scope, children });
}

/** Client route scope for TanStack-native contracts and exact query keys. */
export function RouteContractProvider<TParams>(props: {
  contract: RouteContract<TParams>;
  params: TParams;
  children: React.ReactNode;
}): React.ReactElement {
  const { contract, params, children } = props;
  const scope = React.useMemo<RouteScope>(() => {
    const entries = contract.getLoadEntries(params);
    return {
      resourceNames: new Set(),
      queryHashes: contract.getPrefetchedQueryHashes(params),
      queryContractNames: new Set(
        entries.flatMap((entry) => {
          const metadata = readP9vQueryMetadata(entry.query.meta);
          return metadata?.contractName ? [metadata.contractName] : [];
        }),
      ),
      components: contract.includes,
      routeName: contract.name,
    };
  }, [contract, params]);
  return React.createElement(RouteScopeProvider, { scope, children });
}
