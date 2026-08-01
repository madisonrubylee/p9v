import { hashKey, type QueryKey } from "@tanstack/react-query";
import { readP9vQueryMetadata } from "./metadata.js";
import type {
  ContractNameOf,
  ContractQueryInstance,
  QueryContract,
} from "./queryContract.js";

type AnyQueryContract = QueryContract<any, any, any>;
type AnyContractQueryInstance = ContractQueryInstance<any, any>;
type IsAny<T> = 0 extends 1 & T ? true : false;

export type RouteQueryPolicy = "blocking" | "streaming";

export interface RouteLoadEntry<
  TQuery extends AnyContractQueryInstance = AnyContractQueryInstance,
> {
  readonly query: TQuery;
  readonly policy: RouteQueryPolicy;
}

export interface QueryRequirementComponent {
  readonly queryRequirements?: readonly AnyQueryContract[];
  readonly displayName?: string;
  readonly name?: string;
}

type RequiredContractName<
  TIncludes extends readonly QueryRequirementComponent[],
> = TIncludes[number] extends infer TComponent
  ? TComponent extends { readonly queryRequirements: infer TRequirements }
    ? TRequirements extends readonly AnyQueryContract[]
      ? TRequirements[number]["contractName"]
      : never
    : never
  : never;

type LoadedContractName<TLoad extends readonly RouteLoadEntry[]> =
  ContractNameOf<TLoad[number]["query"]>;

type MissingContractName<
  TLoad extends readonly RouteLoadEntry[],
  TIncludes extends readonly QueryRequirementComponent[],
> = Exclude<RequiredContractName<TIncludes>, LoadedContractName<TLoad>>;

type CompleteRouteConstraint<
  TLoad extends readonly RouteLoadEntry[],
  TIncludes extends readonly QueryRequirementComponent[],
> = [MissingContractName<TLoad, TIncludes>] extends [never]
  ? unknown
  : IsAny<MissingContractName<TLoad, TIncludes>> extends true
    ? unknown
    : {
        readonly __p9vMissingQueryContract: MissingContractName<
          TLoad,
          TIncludes
        >;
      };

export interface RouteQueryRequirement {
  readonly queryName: string;
  readonly componentName: string;
}

export interface RouteContractConfig<
  TParams,
  TLoad extends readonly RouteLoadEntry[],
  TIncludes extends readonly QueryRequirementComponent[],
> {
  readonly name?: string;
  readonly load: (params: TParams) => TLoad;
  readonly includes?: TIncludes;
}

export interface RouteContract<
  TParams = unknown,
  TLoad extends readonly RouteLoadEntry[] = readonly RouteLoadEntry[],
  TIncludes extends readonly QueryRequirementComponent[] = readonly QueryRequirementComponent[],
> {
  readonly __p9vRouteContract: true;
  readonly name: string | undefined;
  readonly includes: TIncludes;
  readonly requiredQueries: readonly RouteQueryRequirement[];
  readonly getLoadEntries: (params: TParams) => TLoad;
  readonly getPrefetchedQueryKeys: (params: TParams) => readonly QueryKey[];
  readonly getPrefetchedQueryHashes: (params: TParams) => ReadonlySet<string>;
}

export function defineRouteContract<
  TParams,
  const TLoad extends readonly RouteLoadEntry[],
  const TIncludes extends readonly QueryRequirementComponent[] = readonly [],
>(
  config: RouteContractConfig<TParams, TLoad, TIncludes> &
    CompleteRouteConstraint<TLoad, TIncludes>,
): RouteContract<TParams, TLoad, TIncludes> {
  const includes = (config.includes ?? []) as unknown as TIncludes;
  const requiredQueries = includes.flatMap((component) => {
    const componentName =
      component.displayName || component.name || "<anonymous>";
    return (component.queryRequirements ?? []).map((query) => ({
      queryName: query.contractName,
      componentName,
    }));
  });

  return {
    __p9vRouteContract: true,
    name: config.name,
    includes,
    requiredQueries,
    getLoadEntries: config.load,
    getPrefetchedQueryKeys: (params) =>
      config.load(params).map((entry) => entry.query.queryKey),
    getPrefetchedQueryHashes: (params) =>
      new Set(config.load(params).map((entry) => hashKey(entry.query.queryKey))),
  };
}

export function findMissingQueryRequirements(
  entries: readonly RouteLoadEntry[],
  requirements: readonly RouteQueryRequirement[],
): RouteQueryRequirement[] {
  const loadedNames = new Set(
    entries.map(
      (entry) => readP9vQueryMetadata(entry.query.meta)?.contractName,
    ),
  );
  return requirements.filter(
    (requirement) => !loadedNames.has(requirement.queryName),
  );
}
