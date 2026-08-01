import * as React from "react";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  hashKey,
  type DehydratedState,
  type QueryFunction,
  type QueryKey,
} from "@tanstack/react-query";
import type { RouteQuery } from "../routeQuery.js";
import type { ResourceInstance } from "../types.js";
import { findMissingRouteRequirements } from "../routeQuery.js";
import {
  findMissingQueryRequirements,
  type RouteContract,
  type RouteLoadEntry,
  type RouteQueryPolicy,
} from "../routeContract.js";
import {
  prepareContractQueryForPrefetch,
  readContractQueryInstance,
  type ContractQueryOptions,
} from "../queryContract.js";
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
  contract?: never;
}

export interface ResourcePrefetchProps extends SharedPrefetchProps {
  /** Resource instances to start together without declaring a route query. */
  resources: readonly ResourceInstance<any, any>[];
  /** Optional route label shown in Devtools. */
  name?: string;
  query?: never;
  params?: never;
  contract?: never;
}

export interface ContractPrefetchProps<TParams>
  extends Omit<SharedPrefetchProps, "mode"> {
  /** A TanStack-native route contract with per-query execution policies. */
  contract: RouteContract<TParams>;
  params: TParams;
  query?: never;
  resources?: never;
  name?: never;
  mode?: never;
}

export type PrefetchProps<TParams = unknown> =
  | RoutePrefetchProps<TParams>
  | ResourcePrefetchProps
  | ContractPrefetchProps<TParams>;

interface PrefetchItem {
  readonly queryOptions: ContractQueryOptions;
  readonly queryKey: QueryKey;
  readonly resourceName: string;
  readonly policy: RouteQueryPolicy;
  readonly kind: "query" | "infinite";
}

/**
 * Server component that starts resources **in parallel**, dehydrates the
 * cache, and hydrates it on the client. It accepts a TanStack-native route
 * contract, a legacy route query, or direct resource instances. Streaming
 * entries dehydrate pending query promises for RSC frameworks that can
 * serialize them. This absorbs the
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
  const isContract = "contract" in props && props.contract !== undefined;
  const isRouteQuery = "query" in props && props.query !== undefined;
  let mode: "blocking" | "streaming" = "blocking";
  if (!isContract && "mode" in props && props.mode) mode = props.mode;

  let routeName: string | undefined;
  if (isContract) routeName = props.contract.name;
  else if (isRouteQuery) routeName = props.query.name;
  else routeName = props.name;

  let instances: readonly ResourceInstance<any, any>[] = [];
  if (isRouteQuery) instances = props.query.getRootInstances(props.params);
  else if ("resources" in props) instances = props.resources ?? [];
  const contractEntries = isContract
    ? props.contract.getLoadEntries(props.params)
    : [];

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
  if (!isProd && isContract) {
    const missingQueries = findMissingQueryRequirements(
      contractEntries,
      props.contract.requiredQueries,
    );
    if (missingQueries.length > 0) {
      throw new P9vRouteConfigError({ routeName, missingQueries });
    }
  }
  const sessionId = `server:${Date.now()}:${++serverSessionSequence}`;

  const items: PrefetchItem[] = isContract
    ? contractEntries.map((entry: RouteLoadEntry) => {
        const queryOptions = prepareContractQueryForPrefetch(
          entry.query,
          routeName ?? null,
        );
        const contract = readContractQueryInstance(entry.query);
        const keyResourceName = String(queryOptions.queryKey[0] ?? "query");
        return {
          queryOptions,
          queryKey: queryOptions.queryKey,
          resourceName: contract?.name ?? keyResourceName,
          policy: entry.policy,
          kind:
            contract?.kind ??
            ("initialPageParam" in queryOptions ? "infinite" : "query"),
        };
      })
    : instances.map((instance) => ({
        queryOptions: instance.queryOptions,
        queryKey: instance.queryKey,
        resourceName: instance.resourceName,
        policy: mode,
        kind: "query" as const,
      }));

  const prefetches = items.map((item, index) => {
    const prefetch = (queryOptions: ContractQueryOptions) =>
      item.kind === "infinite"
        ? client.prefetchInfiniteQuery(queryOptions as never)
        : client.prefetchQuery(queryOptions as never);
    if (!shouldCollectDevtoolsTimings) {
      return prefetch(item.queryOptions);
    }

    const originalQueryFn = item.queryOptions.queryFn;
    if (typeof originalQueryFn !== "function") {
      return prefetch(item.queryOptions);
    }
    const devtoolsMeta = createP9vDevtoolsMeta({
      sessionId,
      routeName: routeName ?? null,
    });

    const instrumentedQueryFn: QueryFunction<unknown> = async (context) => {
      const startedAt = Date.now();
      const timing: QueryTiming = {
        id: `${sessionId}:${index}:${startedAt}`,
        keyHash: hashKey(item.queryKey),
        key: item.queryKey,
        resource: item.resourceName,
        owner: null,
        startedAt,
        settledAt: null,
        status: "pending",
        source: "server",
        sessionId,
        routeName: routeName ?? null,
        classification: "prefetched",
      };
      devtoolsMeta.timings.push(timing);

      try {
        const data = await (originalQueryFn as QueryFunction<unknown>)(context);
        timing.status = "success";
        return data;
      } catch (error) {
        timing.status = "error";
        throw error;
      } finally {
        timing.settledAt = Date.now();
      }
    };

    return prefetch({
      ...item.queryOptions,
      queryFn: instrumentedQueryFn,
      meta: withP9vDevtoolsMeta(item.queryOptions.meta, devtoolsMeta),
    });
  });

  await Promise.all(
    prefetches.filter((_, index) => items[index]?.policy === "blocking"),
  );

  const hasStreamingQueries = items.some((item) => item.policy === "streaming");

  const state: DehydratedState = dehydrate(
    client,
    hasStreamingQueries
      ? {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) ||
            query.state.status === "pending",
        }
      : undefined,
  );

  // Only the client-side cache needs hydrating; the read hooks consume it.
  // RouteQueryProvider/RouteContractProvider can add client-side diagnostics,
  // but remain optional so this server adapter does not force a client boundary.
  return React.createElement(HydrationBoundary, { state }, children);
}

export { makeQueryClient };
