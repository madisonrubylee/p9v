import * as React from "react";
import type { RouteComponent } from "./types.js";

const isProd = process.env.NODE_ENV === "production";

export interface P9vConfig {
  /**
   * When true, `useFragment` throws on a cache miss (a waterfall) instead of
   * silently fetching. Defaults to `true` in development, `false` in production.
   */
  strict: boolean;
}

const DEFAULT_CONFIG: P9vConfig = { strict: !isProd };

const ConfigContext = React.createContext<P9vConfig>(DEFAULT_CONFIG);

export function useP9vConfig(): P9vConfig {
  return React.useContext(ConfigContext);
}

/**
 * Optional provider to override p9v's strict behavior for a subtree.
 * Most apps never need this — strict mode is on in dev by default.
 */
export function P9vProvider(props: {
  strict?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const value = React.useMemo<P9vConfig>(
    () => ({ strict: props.strict ?? DEFAULT_CONFIG.strict }),
    [props.strict],
  );
  return React.createElement(
    ConfigContext.Provider,
    { value },
    props.children,
  );
}

/**
 * The set of resource names the active route query is known to prefetch. Used
 * only to produce a friendlier waterfall error ("add X to the route query's
 * includes"). Populated by {@link RouteQueryProvider} when present.
 */
export interface RouteScope {
  readonly resourceNames: ReadonlySet<string>;
  readonly components: readonly RouteComponent[];
  readonly routeName: string | undefined;
}

const RouteScopeContext = React.createContext<RouteScope | null>(null);

export function useRouteScope(): RouteScope | null {
  return React.useContext(RouteScopeContext);
}

export function RouteScopeProvider(props: {
  scope: RouteScope;
  children: React.ReactNode;
}): React.ReactElement {
  return React.createElement(
    RouteScopeContext.Provider,
    { value: props.scope },
    props.children,
  );
}
