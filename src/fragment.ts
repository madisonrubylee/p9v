import type {
  Fragment,
  FragmentOptions,
  Resource,
} from "./types.js";

/**
 * Declare the fields a component needs from a resource.
 *
 * The returned fragment is both a compile-time contract (the component only
 * "sees" the declared fields via `Pick`) and a dev-time runtime guard (reading
 * an undeclared field throws). Colocate this next to the component that uses it.
 *
 * @example
 * ```tsx
 * const UserCard_user = fragment(userResource, ["id", "name", "avatarUrl"]);
 *
 * function UserCard({ userId }: { userId: string }) {
 *   const user = useFragment(UserCard_user, userId);
 *   //    ^? { id: string; name: string; avatarUrl: string }
 *   return <div>{user.name}</div>;
 * }
 * UserCard.fragments = [UserCard_user] as const;
 * ```
 */
export function fragment<TArg, TData, const TField extends keyof TData>(
  resource: Resource<TArg, TData>,
  fields: readonly TField[],
  options: FragmentOptions = {},
): Fragment<TArg, TData, TField> {
  return {
    __p9vFragment: true,
    resource,
    fields,
    name: options.name ?? resource.resourceName,
    defer: options.defer ?? false,
  };
}
