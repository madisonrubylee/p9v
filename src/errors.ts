import type { Fragment } from "./types.js";
import type { RouteScope } from "./context.js";

/**
 * Thrown (in strict / dev mode) when `useFragment` finds no prefetched data in
 * the cache. That absence *is* a request waterfall: the component rendered
 * before its data was ready, so it would have triggered a client-side fetch.
 */
export class P9vWaterfallError extends Error {
  readonly fragmentName: string;
  readonly resourceName: string;
  readonly queryKey: unknown;
  readonly ownerStack: string | null;

  constructor(args: {
    fragment: Fragment<any, any, any>;
    queryKey: unknown;
    ownerStack: string | null;
    routeScope: RouteScope | null;
  }) {
    const { fragment, queryKey, ownerStack, routeScope } = args;
    const resourceName = fragment.resource.resourceName;

    const lines = [
      `[p9v] Waterfall detected: no prefetched data for fragment "${fragment.name}" ` +
        `(resource "${resourceName}", key ${safeKey(queryKey)}).`,
      ``,
      `This component rendered before its data was ready, which means it would`,
      `trigger a client-side fetch — a request waterfall.`,
      ``,
      `Fix one of:`,
      `  1. Prefetch it on the route: add this resource to your defineRouteQuery({ root }).`,
    ];

    if (routeScope && !routeScope.resourceNames.has(resourceName)) {
      lines.push(
        `     (The active route${
          routeScope.routeName ? ` "${routeScope.routeName}"` : ""
        } does not prefetch "${resourceName}".)`,
      );
    }

    lines.push(
      `  2. If this waterfall is intentional, mark the fragment deferred:`,
      `     fragment(resource, [...], { defer: true })`,
    );

    if (ownerStack) {
      lines.push(``, `Owner stack:`, ownerStack);
    }

    super(lines.join("\n"));
    this.name = "P9vWaterfallError";
    this.fragmentName = fragment.name;
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
