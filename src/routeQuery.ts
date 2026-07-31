import type {
  Fragment,
  ResourceInstance,
  RouteComponent,
} from "./types.js";

type AnyResourceInstance = ResourceInstance<any, any>;
type AnyRouteComponent = RouteComponent<any>;
type AnyFragment = Fragment<any, any, any, any>;
type IsAny<T> = 0 extends 1 & T ? true : false;

type ComponentFragments<TComponent> = TComponent extends {
  readonly fragments?: infer TFragments;
}
  ? NonNullable<TFragments> extends readonly unknown[]
    ? NonNullable<TFragments>[number]
    : never
  : never;

type FragmentResourceName<TFragment> = TFragment extends {
  readonly resource: { readonly resourceName: infer TName extends string };
}
  ? TName
  : never;

type IncludedResourceName<TIncludes extends readonly AnyRouteComponent[]> =
  FragmentResourceName<ComponentFragments<TIncludes[number]>>;

type RootResourceName<TRoot extends readonly AnyResourceInstance[]> =
  TRoot[number]["resourceName"];

type MissingResourceName<
  TRoot extends readonly AnyResourceInstance[],
  TIncludes extends readonly AnyRouteComponent[],
> = Exclude<IncludedResourceName<TIncludes>, RootResourceName<TRoot>>;

type CompleteRouteConstraint<
  TRoot extends readonly AnyResourceInstance[],
  TIncludes extends readonly AnyRouteComponent[],
> = [MissingResourceName<TRoot, TIncludes>] extends [never]
  ? unknown
  : IsAny<MissingResourceName<TRoot, TIncludes>> extends true
    ? unknown
    : {
        /** @internal Describes resources that must be added to `root`. */
        readonly __p9vMissingPrefetch: MissingResourceName<TRoot, TIncludes>;
      };

export interface RouteResourceRequirement {
  readonly resourceName: string;
  readonly fragmentName: string;
  readonly componentName: string;
}

export interface RouteQueryConfig<
  TParams,
  TRoot extends readonly AnyResourceInstance[] = readonly AnyResourceInstance[],
  TIncludes extends readonly AnyRouteComponent[] = readonly AnyRouteComponent[],
> {
  /**
   * The resource instances this route must prefetch. All of these are fetched
   * **in parallel** on the server, so listing them here is what flattens the
   * waterfall. Derive them from route params.
   */
  root: (params: TParams) => TRoot;
  /**
   * Components (with `.fragments`) rendered by this route. Used to power a
   * dev-time completeness check and friendlier waterfall errors, and consumed
   * by devtools. Optional but recommended.
   */
  includes?: TIncludes;
  /** Optional name shown in errors and devtools. */
  name?: string;
}

export interface RouteQuery<
  TParams,
  TRoot extends readonly AnyResourceInstance[] = readonly AnyResourceInstance[],
  TIncludes extends readonly AnyRouteComponent[] = readonly AnyRouteComponent[],
> {
  readonly name: string | undefined;
  readonly includes: TIncludes;
  /** Fragment resources declared by the components in `includes`. */
  readonly requiredResources: readonly RouteResourceRequirement[];
  /** The parallel set of resource instances to prefetch for these params. */
  getRootInstances: (params: TParams) => TRoot;
  /** Resource names actually returned by `root`. */
  getPrefetchedResourceNames: (params: TParams) => Set<string>;
  /**
   * Every resource name reachable from this route (root + included fragments).
   * @deprecated Prefer `getPrefetchedResourceNames` or `requiredResources`.
   */
  getResourceNames: (params: TParams) => Set<string>;
}

export function findMissingRouteRequirements(
  instances: readonly AnyResourceInstance[],
  requirements: readonly RouteResourceRequirement[],
): RouteResourceRequirement[] {
  const prefetchedNames = new Set(
    instances.map((instance) => instance.resourceName),
  );
  return requirements.filter(
    (requirement) => !prefetchedNames.has(requirement.resourceName),
  );
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
export function defineRouteQuery<
  TParams,
  const TRoot extends readonly AnyResourceInstance[],
  const TIncludes extends readonly AnyRouteComponent[] = readonly [],
>(
  config: RouteQueryConfig<TParams, TRoot, TIncludes> &
    CompleteRouteConstraint<TRoot, TIncludes>,
): RouteQuery<TParams, TRoot, TIncludes> {
  const includes = (config.includes ?? []) as unknown as TIncludes;

  const requiredResources = includes.flatMap((component) => {
    const componentName =
      component.displayName || component.name || "<anonymous>";
    return (component.fragments ?? []).map((frag: AnyFragment) => ({
      resourceName: frag.resource.resourceName,
      fragmentName: frag.name,
      componentName,
    }));
  });

  const getRootInstances = (
    params: TParams,
  ): TRoot => config.root(params);

  const getPrefetchedResourceNames = (params: TParams): Set<string> =>
    new Set(
      getRootInstances(params).map((instance) => instance.resourceName),
    );

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
    requiredResources,
    getRootInstances,
    getPrefetchedResourceNames,
    getResourceNames,
  };
}
