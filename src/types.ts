import type { FetchQueryOptions, QueryKey } from "@tanstack/react-query";

/**
 * A resource is a single, reusable definition of *how* to fetch one kind of
 * server data. It is defined once and referenced from every fragment that needs
 * it. See {@link defineResource}.
 */
export interface ResourceConfig<TArg, TData> {
  /** Stable, human-readable name used in query keys, errors, and devtools. */
  name: string;
  /** Builds the TanStack Query key for a given argument. */
  key: (arg: TArg) => QueryKey;
  /** Fetches the data for a given argument. */
  fetch: (arg: TArg, ctx: { signal?: AbortSignal }) => Promise<TData>;
  /** Optional default `staleTime` (ms) applied to this resource's queries. */
  staleTime?: number;
  /** Optional default `gcTime` (ms) applied to this resource's queries. */
  gcTime?: number;
}

/**
 * A concrete, argument-bound instance of a resource. This is what gets
 * prefetched on the server. Produced by calling a {@link Resource}.
 */
export interface ResourceInstance<TData = unknown> {
  readonly __p9vResourceInstance: true;
  readonly resourceName: string;
  readonly queryKey: QueryKey;
  readonly queryOptions: FetchQueryOptions<TData>;
}

/**
 * The value returned by {@link defineResource}. It is callable — calling it with
 * an argument yields a {@link ResourceInstance} — and also carries the raw
 * config for building fragments, query options, and keys.
 */
export interface Resource<TArg, TData> {
  (arg: TArg): ResourceInstance<TData>;
  readonly resourceName: string;
  readonly key: (arg: TArg) => QueryKey;
  readonly fetch: (arg: TArg, ctx: { signal?: AbortSignal }) => Promise<TData>;
  readonly queryOptions: (arg: TArg) => FetchQueryOptions<TData>;
  /** Phantom carrier for the resource's data type. Never present at runtime. */
  readonly __data?: TData;
}

/**
 * A fragment is a component's declaration of *exactly* which fields of a
 * resource it needs. The declared field list drives both the compile-time type
 * (via `Pick`) and the dev-time runtime mask. See {@link fragment}.
 */
export interface Fragment<TArg, TData, TField extends keyof TData> {
  readonly __p9vFragment: true;
  readonly resource: Resource<TArg, TData>;
  readonly fields: readonly TField[];
  /** Debug name shown in masking errors; defaults to the resource name. */
  readonly name: string;
  /**
   * When `true`, this fragment is an *intentional* waterfall: instead of
   * throwing in strict mode when the data is absent, `useFragment` will fetch
   * it (suspending). This is the escape hatch discussed in TanStack Query
   * discussion #8064.
   */
  readonly defer: boolean;
  /** Phantom carrier for the masked shape. Never present at runtime. */
  readonly __masked?: Pick<TData, TField>;
}

/** Options accepted by {@link fragment}. */
export interface FragmentOptions {
  /** Debug name; defaults to the resource name. */
  name?: string;
  /** Mark this fragment as an intentional (deferred) waterfall. */
  defer?: boolean;
}

/** A component that declares the fragments it (and its subtree) depend on. */
export interface RouteComponent {
  readonly fragments?: readonly Fragment<any, any, any>[];
  readonly displayName?: string;
  readonly name?: string;
}
