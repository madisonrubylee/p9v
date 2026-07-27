import type { FetchQueryOptions, QueryKey } from "@tanstack/react-query";
import type { Resource, ResourceConfig, ResourceInstance } from "./types.js";

/**
 * Define a resource once, use it everywhere.
 *
 * @example
 * ```ts
 * export const userResource = defineResource({
 *   name: "user",
 *   key: (id: string) => ["user", id] as const,
 *   fetch: (id) => api.get<User>(`/users/${id}`),
 * });
 * ```
 */
export function defineResource<TArg, TData>(
  config: ResourceConfig<TArg, TData>,
): Resource<TArg, TData> {
  const queryOptions = (arg: TArg): FetchQueryOptions<TData> => {
    const options: FetchQueryOptions<TData> = {
      queryKey: config.key(arg),
      queryFn: ({ signal }) => config.fetch(arg, { signal }),
    };
    if (config.staleTime !== undefined) options.staleTime = config.staleTime;
    if (config.gcTime !== undefined) options.gcTime = config.gcTime;
    return options;
  };

  const resource = ((arg: TArg): ResourceInstance<TData> => {
    const options = queryOptions(arg);
    return {
      __p9vResourceInstance: true,
      resourceName: config.name,
      queryKey: options.queryKey as QueryKey,
      queryOptions: options,
    };
  }) as Resource<TArg, TData>;

  Object.assign(resource, {
    resourceName: config.name,
    key: config.key,
    fetch: config.fetch,
    queryOptions,
  });

  return resource;
}
