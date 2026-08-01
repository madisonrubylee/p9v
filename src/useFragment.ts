import type { Fragment } from "./types.js";
import { createMask } from "./mask.js";
import { useResourceData } from "./useResourceData.js";

/**
 * Read a fragment's data from the cache — **without fetching**.
 *
 * `useFragment` reads data that a route already started, then returns a masked
 * view containing exactly the declared fields. Pending prefetches reuse their
 * existing promise and suspend. If the query is genuinely missing:
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
  const data = useResourceData(frag.resource, arg, {
    defer: frag.defer,
    kind: "fragment",
    name: frag.name,
  });

  return createMask<TData & object, TField>(
    data as TData & object,
    frag.fields,
    frag.name,
  );
}
