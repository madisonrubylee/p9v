import { describe, expect, it, vi } from "vitest";
import {
  analyzeTimings,
  createP9vDevtoolsMeta,
  formatReport,
  withP9vDevtoolsMeta,
  WaterfallRecorder,
  type QueryTiming,
} from "../src/devtools/index.js";
import { defineResource } from "../src/resource.js";
import { makeClient } from "./helpers.js";

function timing(
  resource: string,
  startedAt: number,
  settledAt: number,
): QueryTiming {
  return {
    keyHash: `["${resource}"]`,
    key: [resource],
    resource,
    owner: null,
    startedAt,
    settledAt,
    status: "success",
  };
}

describe("analyzeTimings", () => {
  it("reports depth 1 when queries run in parallel", () => {
    const report = analyzeTimings([
      timing("user", 0, 300),
      timing("posts", 0, 320),
      timing("stats", 0, 280),
    ]);
    expect(report.depth).toBe(1);
    expect(report.parallelMs).toBe(320);
  });

  it("detects a sequential waterfall chain", () => {
    const report = analyzeTimings([
      timing("user", 0, 300),
      timing("team", 310, 700), // started ~right after user settled
      timing("projects", 705, 1100), // started right after team settled
    ]);
    expect(report.depth).toBe(3);
    expect(report.longestChain.map((i) => report.timings[i]!.resource)).toEqual([
      "user",
      "team",
      "projects",
    ]);
    expect(report.observedMs).toBe(1100);
    expect(report.parallelMs).toBeLessThan(report.observedMs);
  });

  it("formats a readable report", () => {
    const report = analyzeTimings([
      timing("user", 0, 300),
      timing("team", 310, 700),
    ]);
    const text = formatReport(report);
    expect(text).toContain("Waterfall detected");
    expect(text).toContain("user");
    expect(text).toContain("team");
  });
});

describe("WaterfallRecorder", () => {
  it("records fetch timings from a real query client", async () => {
    const client = makeClient();
    let clock = 1000;
    const recorder = new WaterfallRecorder(client, {
      now: () => clock,
    }).start();

    const userResource = defineResource({
      name: "user",
      key: (id: string) => ["user", id],
      fetch: async () => ({ id: "u1", teamId: "t1" }),
    });
    const teamResource = defineResource({
      name: "team",
      key: (id: string) => ["team", id],
      fetch: async () => ({ id: "t1" }),
    });

    clock = 1000;
    const user = await client.fetchQuery(userResource.queryOptions("u1"));
    clock = 1320;
    await client.fetchQuery(teamResource.queryOptions(user.teamId));
    clock = 1700;

    recorder.stop();
    const timings = recorder.getTimings();
    expect(timings.map((t) => t.resource)).toEqual(["user", "team"]);
    expect(timings.every((t) => t.settledAt !== null)).toBe(true);
  });

  it("publishes stable snapshots for fetch, settle, and clear", async () => {
    const client = makeClient();
    const recorder = new WaterfallRecorder(client);
    const listener = vi.fn();
    const unsubscribe = recorder.subscribe(listener);
    const initialSnapshot = recorder.getSnapshot();

    recorder.start();
    const request = client.fetchQuery({
      queryKey: ["snapshot"],
      queryFn: async () => "done",
    });
    expect(recorder.getSnapshot()).not.toBe(initialSnapshot);
    expect(recorder.getSnapshot().timings[0]?.status).toBe("pending");

    await request;
    expect(recorder.getSnapshot().timings[0]?.status).toBe("success");
    expect(listener).toHaveBeenCalledTimes(2);

    recorder.clear();
    expect(recorder.getSnapshot().timings).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    recorder.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    recorder.stop();
  });

  it("ingests hydrated server timings once and preserves cache data on clear", () => {
    const client = makeClient();
    const meta = createP9vDevtoolsMeta({
      sessionId: "server:1",
      routeName: "profile",
    });
    meta.timings.push({
      id: "server:1:user",
      keyHash: '["user","u1"]',
      key: ["user", "u1"],
      resource: "user",
      owner: null,
      startedAt: 100,
      settledAt: 400,
      status: "success",
      source: "server",
      sessionId: "server:1",
      routeName: "profile",
    });
    client.setQueryDefaults(["user", "u1"], {
      meta: withP9vDevtoolsMeta(undefined, meta),
    });
    client.setQueryData(["user", "u1"], { id: "u1" });

    const recorder = new WaterfallRecorder(client).start();
    expect(recorder.getSnapshot().timings).toHaveLength(1);
    expect(recorder.getSnapshot().timings[0]).toMatchObject({
      source: "server",
      sessionId: "server:1",
      routeName: "profile",
    });

    client.setQueryData(["user", "u1"], { id: "u1", updated: true });
    expect(recorder.getSnapshot().timings).toHaveLength(1);

    recorder.clear();
    expect(client.getQueryData(["user", "u1"])).toEqual({
      id: "u1",
      updated: true,
    });
    client.setQueryData(["user", "u1"], { id: "u1", updated: false });
    expect(recorder.getSnapshot().timings).toHaveLength(0);
    recorder.stop();
  });

  it("settles a hydrated pending server timing without a duplicate client timing", async () => {
    const client = makeClient();
    let clock = 100;
    let resolveRequest!: (value: string) => void;
    const meta = createP9vDevtoolsMeta({
      sessionId: "server:stream",
      routeName: "streaming-page",
    });
    meta.timings.push({
      id: "server:stream:profile",
      keyHash: '["streaming-profile"]',
      key: ["streaming-profile"],
      resource: "streaming-profile",
      owner: null,
      startedAt: clock,
      settledAt: null,
      status: "pending",
      source: "server",
      sessionId: "server:stream",
      routeName: "streaming-page",
    });
    client.setQueryDefaults(["streaming-profile"], {
      meta: withP9vDevtoolsMeta(undefined, meta),
    });
    const request = client.fetchQuery({
      queryKey: ["streaming-profile"],
      queryFn: () =>
        new Promise<string>((resolve) => { resolveRequest = resolve; }),
    });
    const recorder = new WaterfallRecorder(client, {
      now: () => clock,
    }).start();

    expect(recorder.getTimings()).toHaveLength(1);
    expect(recorder.getTimings()[0]).toMatchObject({
      source: "server",
      status: "pending",
      settledAt: null,
    });

    clock = 450;
    resolveRequest("done");
    await request;

    expect(recorder.getTimings()).toHaveLength(1);
    expect(recorder.getTimings()[0]).toMatchObject({
      source: "server",
      status: "success",
      settledAt: 450,
    });

    const errorMeta = createP9vDevtoolsMeta({
      sessionId: "server:stream-error",
      routeName: "streaming-page",
    });
    errorMeta.timings.push({
      id: "server:stream:error",
      keyHash: '["streaming-error"]',
      key: ["streaming-error"],
      resource: "streaming-error",
      owner: null,
      startedAt: clock,
      settledAt: null,
      status: "pending",
      source: "server",
      sessionId: "server:stream-error",
      routeName: "streaming-page",
    });
    client.setQueryDefaults(["streaming-error"], {
      meta: withP9vDevtoolsMeta(undefined, errorMeta),
    });
    clock = 700;
    await expect(
      client.fetchQuery({
        queryKey: ["streaming-error"],
        queryFn: async () => { throw new Error("stream failed"); },
      }),
    ).rejects.toThrow("stream failed");

    expect(recorder.getTimings()).toHaveLength(2);
    expect(recorder.getTimings()[1]).toMatchObject({
      source: "server",
      status: "error",
      settledAt: 700,
    });
    recorder.stop();
  });
});
