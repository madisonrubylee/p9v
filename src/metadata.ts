import type { QueryKey } from "@tanstack/react-query";

export type QueryClassification =
  | "prefetched"
  | "intentional-deferred"
  | "unexpected-waterfall";

export interface P9vQueryMetadata {
  readonly version: 1;
  readonly contractName: string;
  readonly queryKey: QueryKey;
  readonly classification: QueryClassification;
  readonly routeName: string | null;
}

export const P9V_QUERY_META_KEY = "__p9v";

export function withP9vQueryMetadata(
  meta: Record<string, unknown> | undefined,
  metadata: P9vQueryMetadata,
): Record<string, unknown> {
  return { ...meta, [P9V_QUERY_META_KEY]: metadata };
}

export function readP9vQueryMetadata(meta: unknown): P9vQueryMetadata | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[P9V_QUERY_META_KEY];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<P9vQueryMetadata>;
  if (
    candidate.version !== 1 ||
    typeof candidate.contractName !== "string" ||
    !Array.isArray(candidate.queryKey) ||
    (candidate.classification !== "prefetched" &&
      candidate.classification !== "intentional-deferred" &&
      candidate.classification !== "unexpected-waterfall")
  ) {
    return null;
  }
  return candidate as P9vQueryMetadata;
}
