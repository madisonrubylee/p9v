import type { Fragment } from "./types.js";

type AnyFragment = Fragment<any, any, any, any>;

/**
 * Attach fragment metadata while preserving the component's exact type and
 * identity. This is an additive alternative to `Component.fragments = ...`.
 */
export function withFragments<
  const TFragments extends readonly AnyFragment[],
  TComponent extends object,
>(
  fragments: TFragments,
  component: TComponent,
): TComponent & { readonly fragments: TFragments } {
  return Object.assign(component, { fragments });
}
