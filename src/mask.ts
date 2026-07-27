const isProd = process.env.NODE_ENV === "production";

const PASSTHROUGH_KEYS = new Set<PropertyKey>([
  "then",
  "catch",
  "finally",
  Symbol.toPrimitive,
  Symbol.toStringTag,
  Symbol.iterator,
  Symbol.asyncIterator,
  "toJSON",
  "constructor",
]);

/**
 * Wraps `data` so that reading any field not declared in `fields` throws in
 * development. This enforces Relay-style data masking: a component can only see
 * what its fragment declared, so deleting a field from a fragment surfaces every
 * place that silently depended on it.
 *
 * In production this is a no-op — the raw object is returned for zero overhead.
 */
export function createMask<T extends object, K extends keyof T>(
  data: T,
  fields: readonly K[],
  fragmentName: string,
): Pick<T, K> {
  if (isProd) return data as Pick<T, K>;

  // Field masking is defined for record-shaped resources. Collections are
  // returned as-is; per-item masking of lists is out of scope for the MVP.
  if (Array.isArray(data)) return data as Pick<T, K>;

  const allowed = new Set<PropertyKey>(fields as readonly PropertyKey[]);

  return new Proxy(data, {
    get(target, prop, receiver) {
      if (PASSTHROUGH_KEYS.has(prop) || typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }
      if (!allowed.has(prop) && prop in target) {
        throw new Error(
          `[p9v] Fragment "${fragmentName}" read the undeclared field "${String(
            prop,
          )}".\n` +
            `  Fix: add "${String(prop)}" to fragment(${fragmentName}, [...]), ` +
            `or read it in the component that owns that data.`,
        );
      }
      return Reflect.get(target, prop, receiver);
    },
    // Keep enumeration honest: only declared keys are "own" keys under masking.
    ownKeys(target) {
      return Reflect.ownKeys(target).filter(
        (k) => typeof k === "symbol" || allowed.has(k),
      );
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === "string" && !allowed.has(prop)) return undefined;
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as Pick<T, K>;
}
