import type { RouteScope } from "./context.js";
import type { RouteResourceRequirement } from "./routeQuery.js";
import type { RouteQueryRequirement } from "./routeContract.js";
import type { Fragment } from "./types.js";

/**
 * Thrown in development before route prefetching starts when an included
 * component declares a resource that the route's `root` does not provide.
 */
export class P9vRouteConfigError extends Error {
  readonly routeName: string | undefined;
  readonly missingResources: readonly RouteResourceRequirement[];
  readonly missingQueries: readonly RouteQueryRequirement[];

  constructor(args: {
    routeName: string | undefined;
    missingResources?: readonly RouteResourceRequirement[];
    missingQueries?: readonly RouteQueryRequirement[];
  }) {
    const { routeName } = args;
    const missingResources = args.missingResources ?? [];
    const missingQueries = args.missingQueries ?? [];
    const routeLabel = routeName ? ` "${routeName}"` : "";
    const resourceDetails = missingResources.map(
      ({ resourceName, fragmentName, componentName }) =>
        `  - resource "${resourceName}" required by ${componentName} ` +
        `(fragment "${fragmentName}")`,
    );
    const queryDetails = missingQueries.map(
      ({ queryName, componentName }) =>
        `  - query contract "${queryName}" required by ${componentName}`,
    );
    const usesQueryContracts = missingQueries.length > 0;

    super(
      [
        `[p9v] Route${routeLabel} is missing required prefetches.`,
        "",
        ...resourceDetails,
        ...queryDetails,
        "",
        usesQueryContracts
          ? "Fix: add each missing query to defineRouteContract({ load })."
          : "Fix: add each missing resource to defineRouteQuery({ root }).",
      ].join("\n"),
    );
    this.name = "P9vRouteConfigError";
    this.routeName = routeName;
    this.missingResources = missingResources;
    this.missingQueries = missingQueries;
  }
}

/**
 * Thrown (in strict / dev mode) when a p9v read hook finds no prefetched query
 * in the cache. That absence *is* a request waterfall: the component rendered
 * before its request was started at the route.
 */
export class P9vWaterfallError extends Error {
  readonly fragmentName: string;
  readonly resourceName: string;
  readonly queryKey: unknown;
  readonly ownerStack: string | null;

  constructor(args: {
    queryKey: unknown;
    ownerStack: string | null;
    routeScope: RouteScope | null;
  } & (
    | {
        read: {
          kind: "fragment" | "resource" | "query";
          name: string;
          resourceName: string;
        };
      }
    | { fragment: Fragment<any, any, any> }
  )) {
    const { queryKey, ownerStack, routeScope } = args;
    const read = "read" in args
      ? args.read
      : {
          kind: "fragment" as const,
          name: args.fragment.name,
          resourceName: args.fragment.resource.resourceName,
        };
    const resourceName = read.resourceName;
    const readLabel = (() => {
      if (read.kind === "fragment") {
        return `fragment "${read.name}" (resource "${resourceName}"`;
      }
      if (read.kind === "query") return `query contract "${read.name}"`;
      return `resource "${resourceName}"`;
    })();
    const readSuffix = read.kind === "fragment" ? ")" : "";

    const lines = [
      `[p9v] Waterfall detected: no prefetched data for ${readLabel}, ` +
        `key ${safeKey(queryKey)}${readSuffix}.`,
      ``,
      `This component rendered before its data was ready, which means it would`,
      `trigger a client-side fetch — a request waterfall.`,
      ``,
      `Fix one of:`,
      `  1. Prefetch it on the route with <Prefetch resources={...}> or defineRouteQuery({ root }).`,
    ];

    if (routeScope && !routeScope.resourceNames.has(resourceName)) {
      lines.push(
        `     (The active route${
          routeScope.routeName ? ` "${routeScope.routeName}"` : ""
        } does not prefetch "${resourceName}".)`,
      );
    }

    if (read.kind === "fragment") {
      lines.push(
        `  2. If this waterfall is intentional, mark the fragment deferred:`,
        `     fragment(resource, [...], { defer: true })`,
      );
    } else if (read.kind === "resource") {
      lines.push(
        `  2. If this waterfall is intentional, opt into fetching:`,
        `     useResource(resource, arg, { defer: true })`,
      );
    } else {
      lines.push(
        `  2. If this client fetch is intentional, opt in on the contract:`,
        `     query(arg, { defer: true })`,
      );
    }

    if (ownerStack) {
      lines.push(``, `Owner stack:`, ownerStack);
    }

    super(lines.join("\n"));
    this.name = "P9vWaterfallError";
    this.fragmentName = read.name;
    this.resourceName = resourceName;
    this.queryKey = queryKey;
    this.ownerStack = ownerStack;
  }
}

function safeKey(key: unknown): string {
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
}
