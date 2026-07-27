import * as React from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import type { RouteQuery } from "../routeQuery.js";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  });
}

/**
 * Returns a request-scoped QueryClient. On the server (React Server Components)
 * this is memoized per request via `React.cache` so every `Prefetch` in the
 * same request shares one cache; otherwise a fresh client is returned.
 */
export const getServerQueryClient: () => QueryClient = (() => {
  const cache = (React as { cache?: <T>(fn: () => T) => () => T }).cache;
  return cache ? cache(makeQueryClient) : makeQueryClient;
})();

export interface PrefetchProps<TParams> {
  query: RouteQuery<TParams>;
  params: TParams;
  children: React.ReactNode;
}

/**
 * Server component that prefetches a route's root resources **in parallel**,
 * dehydrates the cache, and hydrates it on the client. This absorbs the
 * `getQueryClient` / `Promise.all(prefetchQuery)` / `dehydrate` /
 * `HydrationBoundary` boilerplate that every App Router page repeats.
 *
 * @example
 * ```tsx
 * export default async function Page({ params }) {
 *   return (
 *     <Prefetch query={userPageQuery} params={params}>
 *       <UserCard userId={params.id} />
 *     </Prefetch>
 *   );
 * }
 * ```
 */
export async function Prefetch<TParams>(
  props: PrefetchProps<TParams>,
): Promise<React.ReactElement> {
  const { query, params, children } = props;
  const client = getServerQueryClient();

  const instances = query.getRootInstances(params);
  await Promise.all(
    instances.map((instance) => client.prefetchQuery(instance.queryOptions)),
  );

  const state: DehydratedState = dehydrate(client);

  // Only the client-side cache needs hydrating; `useFragment` reads from it.
  // For friendlier waterfall errors ("route X doesn't prefetch Y"), wrap your
  // client subtree in <RouteQueryProvider> from "p9v/react" — it is optional and
  // additive, so we don't force a client boundary here.
  return React.createElement(HydrationBoundary, { state }, children);
}

export { makeQueryClient };
