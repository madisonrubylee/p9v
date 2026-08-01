import * as React from "react";
import {
  hashKey,
  useQueryClient,
  type Query,
  type QueryKey,
  type QueryState,
} from "@tanstack/react-query";
import type { Resource } from "./types.js";
import { captureOwnerStack } from "./ownerStack.js";
import { useP9vConfig, useRouteScope } from "./context.js";
import { P9vWaterfallError } from "./errors.js";
import { withP9vQueryMetadata } from "./metadata.js";

interface ResourceReadOptions {
  readonly defer: boolean;
  readonly kind: "fragment" | "resource";
  readonly name: string;
}

/**
 * Read one resource instance from the TanStack Query cache without mounting a
 * query observer. Both public read hooks use this so cache misses, pending
 * queries, and failed prefetches have identical behavior.
 */
export function useResourceData<
  TArg,
  TData,
  TName extends string,
>(
  resource: Resource<TArg, TData, TName>,
  arg: TArg,
  options: ResourceReadOptions,
): TData {
  const client = useQueryClient();
  const config = useP9vConfig();
  const routeScope = useRouteScope();
  const queryKey = resource.key(arg);
  const { query, state } = useCacheQuery<TData>(queryKey);

  if (state?.data !== undefined) return state.data;

  if (state?.status === "pending" && query?.promise) {
    throw query.promise;
  }

  if (state?.status === "error") {
    throw state.error;
  }

  if (options.defer || !config.strict) {
    const queryOptions = resource.queryOptions(arg);
    throw client.ensureQueryData({
      ...queryOptions,
      meta: withP9vQueryMetadata(queryOptions.meta, {
        version: 1,
        contractName: resource.resourceName,
        queryKey,
        classification: options.defer
          ? "intentional-deferred"
          : "unexpected-waterfall",
        routeName: routeScope?.routeName ?? null,
      }),
    });
  }

  throw new P9vWaterfallError({
    read: {
      kind: options.kind,
      name: options.name,
      resourceName: resource.resourceName,
    },
    queryKey,
    ownerStack: captureOwnerStack(),
    routeScope,
  });
}

interface CacheQuerySnapshot<TData> {
  readonly query: Query<TData> | undefined;
  readonly state: QueryState<TData> | undefined;
}

function useCacheQuery<TData>(queryKey: QueryKey): CacheQuerySnapshot<TData> {
  const client = useQueryClient();
  const keyHash = hashKey(queryKey);
  const cache = client.getQueryCache();

  const findQuery = React.useCallback(
    () => cache.find<TData>({ queryKey, exact: true }),
    // A TanStack key's stable hash identifies the exact cache entry. Depending
    // on the array identity would recreate these callbacks every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cache, keyHash],
  );

  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      cache.subscribe((event) => {
        if (hashKey(event.query.queryKey) === keyHash) onStoreChange();
      }),
    [cache, keyHash],
  );

  const getSnapshot = React.useCallback(
    () => findQuery()?.state as QueryState<TData> | undefined,
    [findQuery],
  );
  const state = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  return { query: findQuery(), state };
}
