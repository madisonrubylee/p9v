import type { QueryKey } from "@tanstack/react-query";
import { P9vWaterfallError } from "./errors.js";
import { captureOwnerStack } from "./ownerStack.js";
import {
  withP9vQueryMetadata,
  type QueryClassification,
} from "./metadata.js";

const isProd = process.env.NODE_ENV === "production";
const QUERY_CONTRACT_RUNTIME = Symbol.for("@p9v/core/query-contract");
declare const queryContractType: unique symbol;

export interface QueryContractOptions {
  /** Allow this query to begin in the browser when it was not prefetched. */
  readonly defer?: boolean;
}

export interface QueryContractConfig<
  TName extends string,
  TArg,
  TOptions extends ContractQueryOptions,
> extends QueryContractOptions {
  readonly name: TName;
  readonly options: (arg: TArg) => TOptions;
}

export interface ContractQueryOptions {
  readonly queryKey: QueryKey;
  readonly queryFn?: unknown;
  readonly meta?: Record<string, unknown>;
  readonly initialPageParam?: unknown;
}

interface RuntimeContractMetadata {
  readonly name: string;
  readonly defer: boolean;
  readonly kind: "query" | "infinite";
  readonly originalQueryFn: unknown;
}

export type ContractQueryInstance<
  TName extends string = string,
  TOptions extends ContractQueryOptions = ContractQueryOptions,
> = TOptions & {
  readonly [queryContractType]: TName;
};

export interface QueryContract<
  TName extends string = string,
  TArg = unknown,
  TOptions extends ContractQueryOptions = ContractQueryOptions,
> {
  (
    arg: TArg,
    options?: QueryContractOptions,
  ): ContractQueryInstance<TName, TOptions>;
  readonly contractName: TName;
  readonly defer: boolean;
}

/**
 * Add a stable p9v identity and cache-miss guard to ordinary TanStack Query
 * options. The returned options can be passed directly to `useQuery`,
 * `useSuspenseQuery`, or their infinite-query equivalents.
 */
export function defineQueryContract<
  const TName extends string,
  TArg,
  TOptions extends ContractQueryOptions,
>(
  config: QueryContractConfig<TName, TArg, TOptions>,
): QueryContract<TName, TArg, TOptions> {
  const contract = ((arg: TArg, callOptions: QueryContractOptions = {}) => {
    const sourceOptions = config.options(arg);
    const shouldDefer = callOptions.defer ?? config.defer ?? false;
    const originalQueryFn = sourceOptions.queryFn;
    const classification: QueryClassification = shouldDefer
      ? "intentional-deferred"
      : "unexpected-waterfall";

    const guardedQueryFn =
      typeof originalQueryFn === "function"
        ? (...queryFnArgs: unknown[]) => {
            if (!shouldDefer && !isProd && typeof window !== "undefined") {
              throw new P9vWaterfallError({
                read: {
                  kind: "query",
                  name: config.name,
                  resourceName: config.name,
                },
                queryKey: sourceOptions.queryKey,
                ownerStack: captureOwnerStack(),
                routeScope: null,
              });
            }
            return originalQueryFn(...queryFnArgs);
          }
        : originalQueryFn;

    const options = {
      ...sourceOptions,
      queryFn: guardedQueryFn,
      meta: withP9vQueryMetadata(sourceOptions.meta, {
        version: 1,
        contractName: config.name,
        queryKey: sourceOptions.queryKey,
        classification,
        routeName: null,
      }),
    } as ContractQueryInstance<TName, TOptions>;

    Object.defineProperty(options, QUERY_CONTRACT_RUNTIME, {
      enumerable: false,
      value: {
        name: config.name,
        defer: shouldDefer,
        kind: "initialPageParam" in sourceOptions ? "infinite" : "query",
        originalQueryFn,
      } satisfies RuntimeContractMetadata,
    });
    return options;
  }) as QueryContract<TName, TArg, TOptions>;

  Object.assign(contract, {
    contractName: config.name,
    defer: config.defer ?? false,
  });
  return contract;
}

export function readContractQueryInstance(
  options: ContractQueryOptions,
): RuntimeContractMetadata | null {
  const value = (options as unknown as Record<PropertyKey, unknown>)[
    QUERY_CONTRACT_RUNTIME
  ];
  return value && typeof value === "object"
    ? (value as RuntimeContractMetadata)
    : null;
}

export function prepareContractQueryForPrefetch<
  TOptions extends ContractQueryOptions,
>(
  options: TOptions,
  routeName: string | null,
): TOptions {
  const contract = readContractQueryInstance(options);
  if (!contract) return options;
  return {
    ...options,
    queryFn: contract.originalQueryFn,
    meta: withP9vQueryMetadata(options.meta, {
      version: 1,
      contractName: contract.name,
      queryKey: options.queryKey,
      classification: "prefetched",
      routeName,
    }),
  } as TOptions;
}

export type ContractNameOf<T> = T extends {
  readonly [queryContractType]: infer TName extends string;
}
  ? TName
  : never;
