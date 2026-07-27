import { describe, expect, it } from "vitest";
import {
  analyzeTimings,
  formatReport,
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
});
