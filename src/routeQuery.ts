import type { ResourceInstance, RouteComponent } from "./types.js";

export interface RouteQueryConfig<TParams> {
  /**
   * The resource instances this route must prefetch. All of these are fetched
   * **in parallel** on the server, so listing them here is what flattens the
   * waterfall. Derive them from route params.
   */
  root: (params: TParams) => readonly ResourceInstance<any>[];
  /**
   * Components (with `.fragments`) rendered by this route. Used to power a
   * dev-time completeness check and friendlier waterfall errors, and consumed
   * by devtools. Optional but recommended.
   */
  includes?: readonly RouteComponent[];
  /** Optional name shown in errors and devtools. */
  name?: string;
}

export interface RouteQuery<TParams> {
  readonly name: string | undefined;
  readonly includes: readonly RouteComponent[];
  /** The parallel set of resource instances to prefetch for these params. */
  getRootInstances: (params: TParams) => readonly ResourceInstance<any>[];
  /** Every resource name reachable from this route (root + included fragments). */
  getResourceNames: (params: TParams) => Set<string>;
}

/**
 * Declare, in one place, everything a route needs. The `root` list is prefetched
 * in parallel; `includes` documents which components live under the route so
 * p9v can enforce that their fragments are covered.
 *
 * @example
 * ```tsx
 * export const userPageQuery = defineRouteQuery({
 *   name: "user-page",
 *   root: (params: { id: string }) => [userResource(params.id)],
 *   includes: [UserCard, UserPosts, UserActivity],
 * });
 * ```
 */
export function defineRouteQuery<TParams>(
  config: RouteQueryConfig<TParams>,
): RouteQuery<TParams> {
  const includes = config.includes ?? [];

  const getRootInstances = (
    params: TParams,
  ): readonly ResourceInstance<any>[] => config.root(params);

  const getResourceNames = (params: TParams): Set<string> => {
    const names = new Set<string>();
    for (const instance of getRootInstances(params)) {
      names.add(instance.resourceName);
    }
    for (const component of includes) {
      for (const frag of component.fragments ?? []) {
        names.add(frag.resource.resourceName);
      }
    }
    return names;
  };

  return {
    name: config.name,
    includes,
    getRootInstances,
    getResourceNames,
  };
}
