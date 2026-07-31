"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  analyzeTimings,
  WaterfallRecorder,
  type QueryTiming,
  type RecorderSnapshot,
  type WaterfallReport,
} from "./index.js";

const DEFAULT_THRESHOLD_MS = 60;
const DEVTOOLS_Z_INDEX = 2_147_483_647;
const PANEL_WIDTH_PX = 440;
const EMPTY_SNAPSHOT: RecorderSnapshot = { revision: 0, timings: [] };
const isProd = process.env.NODE_ENV === "production";

export interface P9vDevtoolsProps {
  /** Defaults to `true` outside production. */
  enabled?: boolean;
  /** Start with the panel expanded. Defaults to `false`. */
  initialIsOpen?: boolean;
  /** Fixed-screen placement. Defaults to `bottom-right`. */
  position?: "bottom-left" | "bottom-right";
  /** Maximum settle-to-start gap inferred as sequential. Defaults to 60ms. */
  sequentialThresholdMs?: number;
}

interface TimingSession {
  id: string;
  source: "server" | "client";
  routeName: string | null;
  timings: QueryTiming[];
  report: WaterfallReport;
  startedAt: number;
}

export function P9vDevtools(props: P9vDevtoolsProps): React.ReactElement | null {
  const enabled = props.enabled ?? !isProd;
  if (!enabled) return null;
  return <EnabledP9vDevtools {...props} />;
}

function EnabledP9vDevtools({
  initialIsOpen = false,
  position = "bottom-right",
  sequentialThresholdMs = DEFAULT_THRESHOLD_MS,
}: P9vDevtoolsProps): React.ReactElement {
  const client = useQueryClient();
  const recorder = React.useMemo(
    () => new WaterfallRecorder(client, { sequentialThresholdMs }),
    [client, sequentialThresholdMs],
  );
  const [isOpen, setIsOpen] = React.useState(initialIsOpen);
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied" | "error">(
    "idle",
  );

  React.useEffect(() => {
    recorder.start();
    return () => {
      recorder.stop();
    };
  }, [recorder]);

  const subscribe = React.useCallback(
    (listener: () => void) => recorder.subscribe(listener),
    [recorder],
  );
  const getSnapshot = React.useCallback(() => recorder.getSnapshot(), [recorder]);
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_SNAPSHOT,
  );
  const sessions = React.useMemo(
    () => createSessions(snapshot.timings, sequentialThresholdMs),
    [snapshot, sequentialThresholdMs],
  );
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ??
    sessions[0] ??
    null;

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const clear = () => {
    recorder.clear();
    setSelectedSessionId(null);
    setCopyStatus("idle");
  };

  const copyJson = async () => {
    if (!selectedSession) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(selectedSession.timings, null, 2),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  const edgeStyle = position === "bottom-left" ? { left: 12 } : { right: 12 };

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="Open p9v Devtools"
        onClick={() => setIsOpen(true)}
        style={{
          ...baseFont,
          ...edgeStyle,
          position: "fixed",
          bottom: 12,
          zIndex: DEVTOOLS_Z_INDEX,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 11px",
          border: "1px solid #394056",
          borderRadius: 8,
          background: "#151924",
          color: "#f4f6fb",
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <StatusDot report={selectedSession?.report ?? null} />
        <strong style={{ fontSize: 12, letterSpacing: ".02em" }}>p9v</strong>
        <span style={{ color: "#9ca6bd", fontSize: 11 }}>
          {badgeLabel(selectedSession?.report ?? null)}
        </span>
      </button>
    );
  }

  return (
    <aside
      aria-label="p9v Devtools"
      style={{
        ...baseFont,
        ...edgeStyle,
        position: "fixed",
        bottom: 12,
        zIndex: DEVTOOLS_Z_INDEX,
        width: `min(${PANEL_WIDTH_PX}px, calc(100vw - 24px))`,
        maxHeight: "min(680px, calc(100vh - 24px))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid #394056",
        borderRadius: 12,
        background: "#0f121a",
        color: "#f4f6fb",
        boxShadow: "0 20px 60px rgba(0,0,0,.55)",
      }}
    >
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <StatusDot report={selectedSession?.report ?? null} />
          <strong style={{ fontSize: 13 }}>p9v Devtools</strong>
        </div>
        <button
          type="button"
          aria-label="Close p9v Devtools"
          onClick={() => setIsOpen(false)}
          style={iconButtonStyle}
        >
          ×
        </button>
      </header>

      <div style={{ padding: 12, borderBottom: "1px solid #252b3a" }}>
        {sessions.length > 0 ? (
          <select
            aria-label="Timing session"
            value={selectedSession?.id ?? ""}
            onChange={(event) => setSelectedSessionId(event.target.value)}
            style={selectStyle}
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {sessionLabel(session)}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ color: "#9ca6bd", fontSize: 12 }}>
            Waiting for p9v or TanStack Query requests…
          </div>
        )}
      </div>

      {selectedSession ? (
        <>
          <Summary session={selectedSession} />
          <Timeline session={selectedSession} />
        </>
      ) : (
        <div style={{ padding: "28px 18px", color: "#7f899f", fontSize: 12 }}>
          Server timings appear for p9v &lt;Prefetch&gt; resources. Client timings
          appear for browser-side TanStack Query fetches.
        </div>
      )}

      <footer style={footerStyle}>
        <button type="button" onClick={clear} style={actionButtonStyle}>
          Clear
        </button>
        <button
          type="button"
          onClick={copyJson}
          disabled={!selectedSession}
          style={{
            ...actionButtonStyle,
            opacity: selectedSession ? 1 : 0.45,
          }}
        >
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "error"
              ? "Copy failed"
              : "Copy JSON"}
        </button>
      </footer>
    </aside>
  );
}

function Summary({ session }: { session: TimingSession }): React.ReactElement {
  const { report } = session;
  const savingMs = Math.max(0, report.observedMs - report.parallelMs);
  const hasSuspectedWaterfall = report.depth > 1;

  return (
    <section
      aria-label="Timing summary"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        padding: 12,
        borderBottom: "1px solid #252b3a",
      }}
    >
      <Metric label="Observed" value={`${Math.round(report.observedMs)}ms`} />
      <Metric label="If parallel" value={`~${Math.round(report.parallelMs)}ms`} />
      <Metric
        label={hasSuspectedWaterfall ? "Potential saving" : "Depth"}
        value={
          hasSuspectedWaterfall ? `${Math.round(savingMs)}ms` : String(report.depth)
        }
        accent={hasSuspectedWaterfall}
      />
      <div
        style={{
          gridColumn: "1 / -1",
          color: hasSuspectedWaterfall ? "#f5b942" : "#68d391",
          fontSize: 11,
        }}
      >
        {hasSuspectedWaterfall
          ? `Suspected waterfall · depth ${report.depth}`
          : "No suspected waterfall in this session"}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div>
      <div style={{ color: "#7f899f", fontSize: 9, textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          color: accent ? "#f5b942" : "#f4f6fb",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Timeline({ session }: { session: TimingSession }): React.ReactElement {
  const { report, timings } = session;
  const criticalPath = new Set(report.depth > 1 ? report.longestChain : []);
  const firstStart = Math.min(...timings.map((timing) => timing.startedAt));
  const span = Math.max(report.observedMs, 1);

  return (
    <section
      aria-label="Query timeline"
      style={{ overflowY: "auto", padding: "5px 12px 10px" }}
    >
      {timings.map((timing, index) => {
        const end = timing.settledAt ?? timing.startedAt;
        const left = ((timing.startedAt - firstStart) / span) * 100;
        const width = Math.max(((end - timing.startedAt) / span) * 100, 1.5);
        const duration = Math.round(end - timing.startedAt);
        const isCritical = criticalPath.has(index);

        return (
          <details
            key={timing.id ?? `${timing.keyHash}:${timing.startedAt}:${index}`}
            style={{ borderBottom: "1px solid #1d2230", padding: "9px 0" }}
          >
            <summary
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(90px, 1fr) 2fr 46px",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              <span
                title={timing.owner ?? timing.resource ?? timing.keyHash}
                style={{
                  overflow: "hidden",
                  color: isCritical ? "#f5b942" : "#d8deec",
                  fontSize: 11,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isCritical ? "▶ " : ""}
                {timing.owner ? `${timing.owner} · ` : ""}
                {timing.resource ?? timing.keyHash}
              </span>
              <span
                aria-label={`${duration}ms timeline bar`}
                style={{
                  position: "relative",
                  height: 8,
                  overflow: "hidden",
                  borderRadius: 999,
                  background: "#202636",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${Math.min(left, 100)}%`,
                    width: `${Math.min(width, 100 - Math.min(left, 100))}%`,
                    minWidth: 2,
                    borderRadius: 999,
                    background: statusColor(timing.status, isCritical),
                  }}
                />
              </span>
              <span style={{ color: "#9ca6bd", fontSize: 10, textAlign: "right" }}>
                {timing.status === "pending"
                  ? "pending"
                  : timing.status === "error"
                    ? "error"
                    : `${duration}ms`}
              </span>
            </summary>
            <code
              style={{
                display: "block",
                marginTop: 8,
                padding: 8,
                overflowWrap: "anywhere",
                borderRadius: 6,
                background: "#090b10",
                color: "#9ca6bd",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 10,
                lineHeight: 1.5,
              }}
            >
              {JSON.stringify(timing.key)}
            </code>
          </details>
        );
      })}
    </section>
  );
}

function StatusDot({ report }: { report: WaterfallReport | null }): React.ReactElement {
  const color = !report ? "#7f899f" : report.depth > 1 ? "#f5b942" : "#68d391";
  return (
    <span
      aria-hidden="true"
      style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
    />
  );
}

function createSessions(
  timings: readonly QueryTiming[],
  threshold: number,
): TimingSession[] {
  const groups = new Map<string, QueryTiming[]>();
  for (const timing of timings) {
    const source = timing.source ?? "client";
    const id = timing.sessionId ?? `${source}:legacy`;
    const group = groups.get(id) ?? [];
    group.push(timing);
    groups.set(id, group);
  }

  return [...groups.entries()]
    .map(([id, sessionTimings]) => {
      const sortedTimings = [...sessionTimings].sort(
        (left, right) => left.startedAt - right.startedAt,
      );
      const first = sortedTimings[0]!;
      return {
        id,
        source: first.source ?? "client",
        routeName: first.routeName ?? null,
        timings: sortedTimings,
        report: analyzeTimings(sortedTimings, threshold),
        startedAt: first.startedAt,
      };
    })
    .sort((left, right) => right.startedAt - left.startedAt);
}

function sessionLabel(session: TimingSession): string {
  const source = session.source === "server" ? "Server" : "Client";
  const name = session.routeName ? ` · ${session.routeName}` : "";
  return `${source}${name} · ${session.timings.length} queries`;
}

function badgeLabel(report: WaterfallReport | null): string {
  if (!report) return "No data";
  return report.depth > 1 ? `suspected depth ${report.depth}` : `depth ${report.depth}`;
}

function statusColor(status: QueryTiming["status"], isCritical: boolean): string {
  if (status === "error") return "#fc8181";
  if (status === "pending") return "#63b3ed";
  return isCritical ? "#f5b942" : "#68d391";
}

const baseFont: React.CSSProperties = {
  all: "initial",
  boxSizing: "border-box",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  colorScheme: "dark",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid #252b3a",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: 10,
  borderTop: "1px solid #252b3a",
};

const iconButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#9ca6bd",
  cursor: "pointer",
  fontSize: 20,
  lineHeight: 1,
};

const actionButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  border: "1px solid #394056",
  borderRadius: 6,
  background: "#1b2030",
  color: "#d8deec",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 10,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  border: "1px solid #394056",
  borderRadius: 6,
  background: "#151924",
  color: "#d8deec",
  fontFamily: "inherit",
  fontSize: 11,
};
