// Server-safe core. Everything here can be imported from React Server
// Components. Client-only APIs (hooks, providers, context) live in "p9v/react".

export { defineResource } from "./resource.js";
export { fragment } from "./fragment.js";
export { defineRouteQuery } from "./routeQuery.js";
export { P9vWaterfallError } from "./errors.js";
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
