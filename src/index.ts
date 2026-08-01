// Server-safe core. Everything here can be imported from React Server
// Components. Client-only APIs live in "@p9v/core/react".

export { defineResource } from "./resource.js";
export { fragment } from "./fragment.js";
export { withFragments } from "./withFragments.js";
export { defineRouteQuery } from "./routeQuery.js";
export { defineQueryContract } from "./queryContract.js";
export { withQueryRequirements } from "./withQueryRequirements.js";
export { defineRouteContract } from "./routeContract.js";
export { P9vRouteConfigError, P9vWaterfallError } from "./errors.js";
export { createMask } from "./mask.js";
export { captureOwnerStack, captureOwnerName } from "./ownerStack.js";

export type {
  Resource,
  ResourceConfig,
  ResourceInstance,
  Fragment,
  FragmentOptions,
  RouteComponent,
} from "./types.js";
export type { RouteQuery, RouteQueryConfig } from "./routeQuery.js";
export type { RouteResourceRequirement } from "./routeQuery.js";
export type {
  ContractQueryInstance,
  ContractQueryOptions,
  QueryContract,
  QueryContractConfig,
  QueryContractOptions,
} from "./queryContract.js";
export type {
  QueryRequirementComponent,
  RouteContract,
  RouteContractConfig,
  RouteLoadEntry,
  RouteQueryPolicy,
  RouteQueryRequirement,
} from "./routeContract.js";
