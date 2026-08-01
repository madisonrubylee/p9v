import type { Resource } from "./types.js";
import { useResourceData } from "./useResourceData.js";

export interface UseResourceOptions {
  /** Allow an intentional cache miss to fetch and suspend instead of erroring. */
  readonly defer?: boolean;
}

/**
 * Reactively read a complete resource from the prefetched cache.
 *
 * Unlike `useFragment`, this beginner-friendly API does not mask fields. In
 * strict mode a genuine cache miss is still reported as a waterfall.
 */
export function useResource<
  TArg,
  TData,
  TName extends string,
>(
  resource: Resource<TArg, TData, TName>,
  arg: TArg,
  options: UseResourceOptions = {},
): TData {
  return useResourceData(resource, arg, {
    defer: options.defer ?? false,
    kind: "resource",
    name: resource.resourceName,
  });
}
