import type { QueryContract } from "./queryContract.js";

type AnyQueryContract = QueryContract<any, any, any>;

/** Attach query dependency metadata while preserving the component's type. */
export function withQueryRequirements<
  const TRequirements extends readonly AnyQueryContract[],
  TComponent extends object,
>(
  requirements: TRequirements,
  component: TComponent,
): TComponent & { readonly queryRequirements: TRequirements } {
  return Object.assign(component, { queryRequirements: requirements });
}
