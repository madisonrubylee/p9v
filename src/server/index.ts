import * as React from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
  hashKey,
  type DehydratedState,
  type QueryFunction,
} from "@tanstack/react-query";
import type { RouteQuery } from "../routeQuery.js";
import { findMissingRouteRequirements } from "../routeQuery.js";
import { P9vRouteConfigError } from "../errors.js";
import {
  createP9vDevtoolsMeta,
  withP9vDevtoolsMeta,
  type QueryTiming,
} from "../devtools/index.js";

const isProd = process.env.NODE_ENV === "production";
let serverSessionSequence = 0;

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
  /** Collect server resource timings for `P9vDevtools`. Defaults to dev-only. */
  devtools?: boolean;
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
  const shouldCollectDevtoolsTimings = props.devtools ?? !isProd;
  const client = getServerQueryClient();

  const instances = query.getRootInstances(params);
  if (!isProd) {
    const missingResources = findMissingRouteRequirements(
      instances,
      query.requiredResources,
    );
    if (missingResources.length > 0) {
      throw new P9vRouteConfigError({
        routeName: query.name,
        missingResources,
      });
    }
  }
  const sessionId = `server:${Date.now()}:${++serverSessionSequence}`;

  await Promise.all(
    instances.map((instance, index) => {
      if (!shouldCollectDevtoolsTimings) {
        return client.prefetchQuery(instance.queryOptions);
      }

      const originalQueryFn = instance.queryOptions.queryFn;
      if (typeof originalQueryFn !== "function") {
        return client.prefetchQuery(instance.queryOptions);
      }
      const devtoolsMeta = createP9vDevtoolsMeta({
        sessionId,
        routeName: query.name ?? null,
      });

      const instrumentedQueryFn: QueryFunction<unknown> = async (context) => {
        const startedAt = Date.now();
        const timing: QueryTiming = {
          id: `${sessionId}:${index}:${startedAt}`,
          keyHash: hashKey(instance.queryKey),
          key: instance.queryKey,
          resource: instance.resourceName,
          owner: null,
          startedAt,
          settledAt: null,
          status: "pending",
          source: "server",
          sessionId,
          routeName: query.name ?? null,
        };
        devtoolsMeta.timings.push(timing);

        try {
          const data = await (originalQueryFn as QueryFunction<unknown>)(
            context,
          );
          timing.status = "success";
          return data;
        } catch (error) {
          timing.status = "error";
          throw error;
        } finally {
          timing.settledAt = Date.now();
        }
      };

      return client.prefetchQuery({
        ...instance.queryOptions,
        queryFn: instrumentedQueryFn,
        meta: withP9vDevtoolsMeta(
          instance.queryOptions.meta,
          devtoolsMeta,
        ),
      });
    }),
  );

  const state: DehydratedState = dehydrate(client);

  // Only the client-side cache needs hydrating; `useFragment` reads from it.
  // For friendlier waterfall errors ("route X doesn't prefetch Y"), wrap your
  // client subtree in <RouteQueryProvider> from "@p9v/core/react" — it is optional and
  // additive, so we don't force a client boundary here.
  return React.createElement(HydrationBoundary, { state }, children);
}

export { makeQueryClient };
