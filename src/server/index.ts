import * as React from "react";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  hashKey,
  type DehydratedState,
  type QueryFunction,
} from "@tanstack/react-query";
import type { RouteQuery } from "../routeQuery.js";
import type { ResourceInstance } from "../types.js";
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

interface SharedPrefetchProps {
  children: React.ReactNode;
  /** Wait for data (default) or pass pending queries to a Suspense boundary. */
  mode?: "blocking" | "streaming";
  /** Collect server resource timings for `P9vDevtools`. Defaults to dev-only. */
  devtools?: boolean;
}

export interface RoutePrefetchProps<TParams> extends SharedPrefetchProps {
  query: RouteQuery<TParams>;
  params: TParams;
  resources?: never;
  name?: never;
}

export interface ResourcePrefetchProps extends SharedPrefetchProps {
  /** Resource instances to start together without declaring a route query. */
  resources: readonly ResourceInstance<any, any>[];
  /** Optional route label shown in Devtools. */
  name?: string;
  query?: never;
  params?: never;
}

export type PrefetchProps<TParams = unknown> =
  | RoutePrefetchProps<TParams>
  | ResourcePrefetchProps;

/**
 * Server component that starts resources **in parallel**, dehydrates the
 * cache, and hydrates it on the client. It accepts either a reusable route
 * query or direct resource instances. Streaming mode dehydrates pending query
 * promises for RSC frameworks that can serialize them. This absorbs the
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
  const { children } = props;
  const shouldCollectDevtoolsTimings = props.devtools ?? !isProd;
  const client = getServerQueryClient();
  const mode = props.mode ?? "blocking";
  const isRouteQuery = "query" in props && props.query !== undefined;
  const routeName = isRouteQuery ? props.query.name : props.name;
  const instances = isRouteQuery
    ? props.query.getRootInstances(props.params)
    : props.resources;

  if (!isProd && isRouteQuery) {
    const missingResources = findMissingRouteRequirements(
      instances,
      props.query.requiredResources,
    );
    if (missingResources.length > 0) {
      throw new P9vRouteConfigError({
        routeName,
        missingResources,
      });
    }
  }
  const sessionId = `server:${Date.now()}:${++serverSessionSequence}`;

  const prefetches = instances.map((instance, index) => {
      if (!shouldCollectDevtoolsTimings) {
        return client.prefetchQuery(instance.queryOptions);
      }

      const originalQueryFn = instance.queryOptions.queryFn;
      if (typeof originalQueryFn !== "function") {
        return client.prefetchQuery(instance.queryOptions);
      }
      const devtoolsMeta = createP9vDevtoolsMeta({
        sessionId,
        routeName: routeName ?? null,
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
          routeName: routeName ?? null,
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
  });

  if (mode === "blocking") {
    await Promise.all(prefetches);
  }

  const state: DehydratedState = dehydrate(
    client,
    mode === "streaming"
      ? {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) ||
            query.state.status === "pending",
        }
      : undefined,
  );

  // Only the client-side cache needs hydrating; the read hooks consume it.
  // For friendlier waterfall errors ("route X doesn't prefetch Y"), wrap your
  // client subtree in <RouteQueryProvider> from "@p9v/core/react" — it is optional and
  // additive, so we don't force a client boundary here.
  return React.createElement(HydrationBoundary, { state }, children);
}

export { makeQueryClient };
