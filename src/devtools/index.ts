import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { captureOwnerName } from "../ownerStack.js";

/** One fetch cycle of one query, as observed by the recorder. */
export interface QueryTiming {
  /** Stable identifier used to deduplicate hydrated server timings. */
  id?: string;
  keyHash: string;
  key: QueryKey;
  /** Resource name — the first string segment of the key, when present. */
  resource: string | null;
  /** Best-effort owning component (dev only; often null outside render). */
  owner: string | null;
  startedAt: number;
  settledAt: number | null;
  status: "pending" | "success" | "error";
  /** Where the observed request ran. Missing on recordings from p9v < 0.2.0. */
  source?: "server" | "client";
  /** Requests are analyzed within, never across, a session. */
  sessionId?: string;
  /** Route name for p9v server-prefetch sessions. */
  routeName?: string | null;
}

export interface RecorderSnapshot {
  /** Increases whenever timings change. */
  revision: number;
  /** Immutable copy suitable for `useSyncExternalStore`. */
  timings: readonly QueryTiming[];
}

export interface P9vDevtoolsMeta {
  readonly version: 1;
  readonly sessionId: string;
  readonly routeName: string | null;
  readonly timings: QueryTiming[];
}

/** An inferred "B waited for A" dependency between two fetch cycles. */
export interface WaterfallEdge {
  from: number; // index into timings
  to: number; // index into timings
  gapMs: number;
}

export interface WaterfallReport {
  timings: QueryTiming[];
  edges: WaterfallEdge[];
  /** The longest sequential chain (indices), i.e. the critical path. */
  longestChain: number[];
  /** Observed wall-clock span from first start to last settle (ms). */
  observedMs: number;
  /** Estimated span if every query ran in parallel from t0 (ms). */
  parallelMs: number;
  /** Depth of the longest waterfall chain (number of sequential fetches). */
  depth: number;
}

export interface RecorderOptions {
  /**
   * Max gap (ms) between one query settling and the next starting for the two
   * to be treated as a dependent (sequential) pair. Default 60ms.
   */
  sequentialThresholdMs?: number;
  /** Provide a clock for tests. Defaults to `Date.now`. */
  now?: () => number;
}

const DEFAULT_THRESHOLD_MS = 60;
const P9V_DEVTOOLS_META_KEY = "__p9vDevtools";
let clientSessionSequence = 0;

export function createP9vDevtoolsMeta(args: {
  sessionId: string;
  routeName: string | null;
}): P9vDevtoolsMeta {
  return {
    version: 1,
    sessionId: args.sessionId,
    routeName: args.routeName,
    timings: [],
  };
}

export function withP9vDevtoolsMeta(
  meta: Record<string, unknown> | undefined,
  devtoolsMeta: P9vDevtoolsMeta,
): Record<string, unknown> {
  return { ...meta, [P9V_DEVTOOLS_META_KEY]: devtoolsMeta };
}

function readP9vDevtoolsMeta(meta: unknown): P9vDevtoolsMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[P9V_DEVTOOLS_META_KEY];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<P9vDevtoolsMeta>;
  if (
    candidate.version !== 1 ||
    typeof candidate.sessionId !== "string" ||
    !Array.isArray(candidate.timings)
  ) {
    return null;
  }
  return candidate as P9vDevtoolsMeta;
}

/**
 * Records TanStack Query fetch timings and reconstructs request waterfalls.
 *
 * Unlike network-tab or monkey-patch approaches, this hangs off the query cache
 * itself, so it understands *queries* (keys, resources) rather than raw URLs.
 * It attributes each fetch to a component via React's owner stack when possible.
 *
 * @example
 * ```ts
 * const recorder = new WaterfallRecorder(queryClient);
 * recorder.start();
 * // ...navigate the app...
 * recorder.stop();
 * console.log(recorder.format());
 * // For `npx p9v analyze`, persist recorder.toJSON() to p9v.record.json.
 * ```
 */
export class WaterfallRecorder {
  private readonly client: QueryClient;
  private readonly now: () => number;
  private readonly threshold: number;
  private readonly sessionId: string;
  private readonly timings: QueryTiming[] = [];
  private readonly inFlight = new Map<string, number>(); // keyHash -> timing index
  private readonly serverInFlight = new Map<string, number[]>();
  private readonly listeners = new Set<() => void>();
  private readonly seenTimingIds = new Set<string>();
  private timingSequence = 0;
  private revision = 0;
  private snapshot: RecorderSnapshot = { revision: 0, timings: [] };
  private unsubscribe: (() => void) | null = null;

  constructor(client: QueryClient, options: RecorderOptions = {}) {
    this.client = client;
    this.now = options.now ?? Date.now;
    this.threshold = options.sequentialThresholdMs ?? DEFAULT_THRESHOLD_MS;
    this.sessionId = `client:${this.now()}:${++clientSessionSequence}`;
  }

  start(): this {
    if (this.unsubscribe) return this;
    const cache = this.client.getQueryCache();
    this.ingestServerTimings(
      cache.getAll().map((query) => query.meta),
    );
    this.unsubscribe = cache.subscribe((event) => {
      this.ingestServerTimings([event.query.meta]);
      if (event.type !== "updated") return;
      const action = (event as { action?: { type?: string } }).action;
      if (!action) return;
      const query = event.query;
      const keyHash = query.queryHash ?? hashKey(query.queryKey);

      if (action.type === "fetch") {
        this.onFetchStart(keyHash, query.queryKey);
      } else if (action.type === "success" || action.type === "error") {
        this.onSettle(keyHash, action.type === "success" ? "success" : "error");
      }
    });
    return this;
  }

  stop(): this {
    this.unsubscribe?.();
    this.unsubscribe = null;
    return this;
  }

  clear(): this {
    for (const timing of this.timings) {
      if (timing.id) this.seenTimingIds.add(timing.id);
    }
    this.timings.length = 0;
    this.inFlight.clear();
    this.serverInFlight.clear();
    this.publishSnapshot();
    return this;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RecorderSnapshot {
    return this.snapshot;
  }

  private onFetchStart(keyHash: string, key: QueryKey): void {
    // A streaming server prefetch resumes from its hydrated promise. Keep it in
    // the original server session instead of reporting a duplicate client fetch.
    if (this.serverInFlight.has(keyHash)) return;

    const index = this.timings.length;
    this.timings.push({
      id: `${this.sessionId}:${++this.timingSequence}`,
      keyHash,
      key,
      resource: typeof key[0] === "string" ? key[0] : null,
      owner: captureOwnerName(),
      startedAt: this.now(),
      settledAt: null,
      status: "pending",
      source: "client",
      sessionId: this.sessionId,
      routeName: null,
    });
    this.inFlight.set(keyHash, index);
    this.publishSnapshot();
  }

  private onSettle(keyHash: string, status: "success" | "error"): void {
    let didChange = false;
    const serverIndexes = this.serverInFlight.get(keyHash) ?? [];
    for (const serverIndex of serverIndexes) {
      const serverTiming = this.timings[serverIndex];
      if (!serverTiming || serverTiming.status !== "pending") continue;
      serverTiming.settledAt = this.now();
      serverTiming.status = status;
      didChange = true;
    }
    if (serverIndexes.length > 0) this.serverInFlight.delete(keyHash);

    const index = this.inFlight.get(keyHash);
    if (index !== undefined) {
      const timing = this.timings[index];
      if (timing) {
        timing.settledAt = this.now();
        timing.status = status;
        didChange = true;
      }
      this.inFlight.delete(keyHash);
    }

    if (didChange) this.publishSnapshot();
  }

  private ingestServerTimings(metas: unknown[]): void {
    let didChange = false;
    for (const meta of metas) {
      const devtoolsMeta = readP9vDevtoolsMeta(meta);
      if (!devtoolsMeta) continue;
      for (const timing of devtoolsMeta.timings) {
        const timingId = timing.id;
        if (!timingId || this.seenTimingIds.has(timingId)) continue;
        this.seenTimingIds.add(timingId);
        const timingIndex = this.timings.length;
        this.timings.push({
          ...timing,
          source: "server",
          sessionId: devtoolsMeta.sessionId,
          routeName: devtoolsMeta.routeName,
        });
        if (timing.status === "pending") {
          const indexes = this.serverInFlight.get(timing.keyHash) ?? [];
          indexes.push(timingIndex);
          this.serverInFlight.set(timing.keyHash, indexes);
        }
        didChange = true;
      }
    }
    if (didChange) this.publishSnapshot();
  }

  private publishSnapshot(): void {
    this.revision += 1;
    this.snapshot = {
      revision: this.revision,
      timings: this.timings.map((timing) => ({ ...timing })),
    };
    for (const listener of this.listeners) listener();
  }

  getTimings(): QueryTiming[] {
    return this.timings.map((t) => ({ ...t }));
  }

  toJSON(): QueryTiming[] {
    return this.getTimings();
  }

  analyze(): WaterfallReport {
    return analyzeTimings(this.getTimings(), this.threshold);
  }

  format(): string {
    return formatReport(this.analyze());
  }
}

/**
 * Pure analysis over recorded timings — inferring the dependency edges and the
 * critical (longest sequential) chain. Separated out so the CLI can run it over
 * a persisted recording.
 */
export function analyzeTimings(
  timings: QueryTiming[],
  sequentialThresholdMs = DEFAULT_THRESHOLD_MS,
): WaterfallReport {
  const settled = timings.filter((t) => t.settledAt !== null);

  const edges: WaterfallEdge[] = [];
  for (let a = 0; a < timings.length; a++) {
    const from = timings[a]!;
    if (from.settledAt === null) continue;
    for (let b = 0; b < timings.length; b++) {
      if (a === b) continue;
      const to = timings[b]!;
      const gap = to.startedAt - from.settledAt;
      // `to` started at (or shortly after) `from` finished => `to` waited on `from`.
      if (gap >= -1 && gap <= sequentialThresholdMs) {
        edges.push({ from: a, to: b, gapMs: gap });
      }
    }
  }

  const longestChain = findLongestChain(timings, edges);
  const depth = longestChain.length;

  const starts = timings.map((t) => t.startedAt);
  const ends = timings.map((t) => t.settledAt ?? t.startedAt);
  const observedMs = timings.length
    ? Math.max(...ends) - Math.min(...starts)
    : 0;

  const durations = settled.map((t) => (t.settledAt ?? t.startedAt) - t.startedAt);
  const parallelMs = durations.length ? Math.max(...durations) : 0;

  return { timings, edges, longestChain, observedMs, parallelMs, depth };
}

function findLongestChain(
  timings: QueryTiming[],
  edges: WaterfallEdge[],
): number[] {
  const outgoing = new Map<number, number[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }

  const memo = new Map<number, number[]>();
  const visiting = new Set<number>();

  const longestFrom = (node: number): number[] => {
    const cached = memo.get(node);
    if (cached) return cached;
    if (visiting.has(node)) return [node]; // guard against cycles
    visiting.add(node);

    let best: number[] = [];
    for (const next of outgoing.get(node) ?? []) {
      const candidate = longestFrom(next);
      if (candidate.length > best.length) best = candidate;
    }
    visiting.delete(node);

    const result = [node, ...best];
    memo.set(node, result);
    return result;
  };

  let overall: number[] = [];
  for (let i = 0; i < timings.length; i++) {
    const chain = longestFrom(i);
    if (chain.length > overall.length) overall = chain;
  }
  return overall;
}

const BAR_WIDTH = 40;

/** Render a report as an ASCII timeline suitable for a terminal. */
export function formatReport(report: WaterfallReport): string {
  const { timings, observedMs, parallelMs, depth } = report;
  if (timings.length === 0) return "[p9v] No queries recorded.";

  const t0 = Math.min(...timings.map((t) => t.startedAt));
  const span = Math.max(observedMs, 1);

  const label = (t: QueryTiming): string => {
    const name = t.resource ?? t.keyHash;
    const owner = t.owner ? `${t.owner} · ` : "";
    return `${owner}${name}`.slice(0, 26).padEnd(26, " ");
  };

  const bar = (t: QueryTiming): string => {
    const end = t.settledAt ?? t.startedAt;
    const startCol = Math.round(((t.startedAt - t0) / span) * BAR_WIDTH);
    const len = Math.max(1, Math.round(((end - t.startedAt) / span) * BAR_WIDTH));
    const dur = Math.round(end - t.startedAt);
    return `${" ".repeat(startCol)}${"█".repeat(len)} ${dur}ms`;
  };

  const inChain = new Set(report.longestChain);
  const rows = timings
    .map((t, i) => `  ${inChain.has(i) ? "▶" : " "} ${label(t)} ${bar(t)}`)
    .join("\n");

  const header =
    depth > 1
      ? `[p9v] Waterfall detected — depth ${depth} (critical path marked ▶)\n` +
        `      observed ${Math.round(observedMs)}ms  →  ~${Math.round(
          parallelMs,
        )}ms if parallelized`
      : `[p9v] No waterfall — ${timings.length} queries ran in parallel (${Math.round(
          observedMs,
        )}ms)`;

  return `${header}\n\n${rows}\n`;
}
