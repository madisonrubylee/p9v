import * as React from "react";

const isProd = process.env.NODE_ENV === "production";

/**
 * Reads React's dev-only Owner Stack (React 19.1+) if available. Returns the
 * trimmed multi-line stack, or `null` in production / older React.
 *
 * The owner stack lists the components responsible for rendering the current
 * component, which lets us name *where* a stray `useFragment` was called.
 */
export function captureOwnerStack(): string | null {
  if (isProd) return null;
  // Access via a computed key so bundlers don't statically flag
  // `captureOwnerStack` as a (sometimes) missing named export of React.
  const key = "captureOwnerStack";
  const capture = (React as unknown as Record<string, unknown>)[key] as
    | (() => string | null)
    | undefined;
  if (typeof capture !== "function") return null;
  try {
    const stack = capture();
    return stack ? stack.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort extraction of the nearest owning component name from the owner
 * stack, e.g. `"UserCard"`. Returns `null` when unavailable.
 */
export function captureOwnerName(): string | null {
  const stack = captureOwnerStack();
  if (!stack) return null;
  const match = stack.match(/at\s+([A-Za-z0-9_$]+)/);
  return match ? match[1]! : null;
}
