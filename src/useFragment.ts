import * as React from "react";
import {
  hashKey,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type { Fragment } from "./types.js";
import { createMask } from "./mask.js";
import { captureOwnerStack } from "./ownerStack.js";
import { useP9vConfig, useRouteScope } from "./context.js";
import { P9vWaterfallError } from "./errors.js";

/**
 * Read a fragment's data from the cache — **without fetching**.
 *
 * `useFragment` never triggers a network request. It only reads data that a
 * route already prefetched, then returns a masked view containing exactly the
 * declared fields. If the data is missing:
 *
 * - deferred fragment → it suspends and fetches (an opt-in waterfall);
 * - strict mode (dev)  → it throws a {@link P9vWaterfallError} naming the
 *   offending component via React's owner stack;
 * - non-strict (prod)  → it suspends and fetches as a safe fallback.
 */
export function useFragment<
  TArg,
  TData,
  TField extends keyof TData,
  TName extends string,
>(
  frag: Fragment<TArg, TData, TField, TName>,
  arg: TArg,
): Pick<TData, TField> {
  const client = useQueryClient();
  const config = useP9vConfig();
  const routeScope = useRouteScope();

  const queryKey = frag.resource.key(arg);
  const data = useCacheData<TData>(client, queryKey);

  if (data === undefined) {
    // Deferred or non-strict: fall back to fetching. Throwing the promise makes
    // the nearest <Suspense> boundary show its fallback until data arrives.
    if (frag.defer || !config.strict) {
      throw client.ensureQueryData(frag.resource.queryOptions(arg));
    }
    throw new P9vWaterfallError({
      fragment: frag,
      queryKey,
      ownerStack: captureOwnerStack(),
      routeScope,
    });
  }

  return createMask<TData & object, TField>(
    data as TData & object,
    frag.fields,
    frag.name,
  );
}

/**
 * Subscribe to a single query's cached data for reactivity, without ever
 * mounting a query observer that could trigger a fetch. Re-renders when that
 * key's data changes in the cache.
 */
function useCacheData<TData>(
  client: QueryClient,
  queryKey: QueryKey,
): TData | undefined {
  const keyHash = hashKey(queryKey);

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const cache = client.getQueryCache();
      return cache.subscribe((event) => {
        if (hashKey(event.query.queryKey) === keyHash) onStoreChange();
      });
    },
    [client, keyHash],
  );

  const getSnapshot = React.useCallback(
    () => client.getQueryData<TData>(queryKey),
    [client, keyHash], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
