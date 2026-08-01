import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { defineRouteQuery } from "../src/routeQuery.js";
import { Prefetch } from "../src/server/index.js";
import { getServerQueryClient } from "../src/server/index.js";
import { P9vRouteConfigError } from "../src/errors.js";
import type { RouteComponent } from "../src/types.js";

describe("Prefetch route validation", () => {
  it("accepts direct resources and blocks after starting them in parallel", async () => {
    const client = getServerQueryClient();
    client.clear();
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const makeResource = (name: "direct-a" | "direct-b") =>
      defineResource({
        name,
        key: () => [name] as const,
        fetch: async () => {
          started.push(name);
          await gate;
          return { name };
        },
      });
    const first = makeResource("direct-a");
    const second = makeResource("direct-b");

    const result = Prefetch({
      resources: [first(undefined), second(undefined)],
      name: "direct-page",
      children: null,
    });
    await vi.waitFor(() => expect(started).toHaveLength(2));
    release();
    const element = await result;
    const state = (element as ReactElement<{ state: unknown }>).props.state as {
      queries: Array<{ state: { status: string }; meta?: Record<string, any> }>;
    };

    expect(state.queries).toHaveLength(2);
    expect(
      state.queries.every((query) => query.state.status === "success"),
    ).toBe(true);
    expect(
      state.queries.every(
        (query) => query.meta?.__p9vDevtools?.routeName === "direct-page",
      ),
    ).toBe(true);
  });

  it("dehydrates pending queries without waiting in streaming mode", async () => {
    const client = getServerQueryClient();
    client.clear();
    let resolveProfile!: (value: { id: string }) => void;
    const fetchProfile = vi.fn(
      () => new Promise<{ id: string }>((resolve) => { resolveProfile = resolve; }),
    );
    const profile = defineResource({
      name: "streaming-profile",
      key: (id: string) => ["streaming-profile", id] as const,
      fetch: fetchProfile,
    });

    const element = await Prefetch({
      resources: [profile("u1")],
      mode: "streaming",
      children: null,
    });
    const state = (element as ReactElement<{ state: unknown }>).props.state as {
      queries: Array<{
        state: { status: string };
        promise?: Promise<unknown>;
        meta?: Record<string, any>;
      }>;
    };

    expect(fetchProfile).toHaveBeenCalledOnce();
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]?.state.status).toBe("pending");
    expect(state.queries[0]?.promise).toBeInstanceOf(Promise);
    expect(
      state.queries[0]?.meta?.__p9vDevtools?.timings[0]?.status,
    ).toBe("pending");

    resolveProfile({ id: "u1" });
    await state.queries[0]?.promise;
  });

  it("fails before fetching and identifies every missing requirement", async () => {
    const fetchUser = vi.fn(async () => ({ id: "u1", name: "Ada" }));
    const userResource = defineResource({
      name: "user",
      key: (id: string) => ["user", id] as const,
      fetch: fetchUser,
    });
    const teamResource = defineResource({
      name: "team",
      key: (id: string) => ["team", id] as const,
      fetch: async () => ({ id: "t1", name: "Core" }),
    });

    const TeamBadge: RouteComponent = Object.assign(() => null, {
      displayName: "TeamBadge",
      fragments: [
        fragment(teamResource, ["name"], { name: "TeamBadge_team" }),
      ],
    });
    const query = defineRouteQuery({
      name: "user-page",
      root: ({ id }: { id: string }) => [userResource(id)],
      includes: [TeamBadge],
    });

    let error: unknown;
    try {
      await Prefetch({ query, params: { id: "u1" }, children: null });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(P9vRouteConfigError);
    expect(error).toMatchObject({
      routeName: "user-page",
      missingResources: [
        {
          resourceName: "team",
          fragmentName: "TeamBadge_team",
          componentName: "TeamBadge",
        },
      ],
    });
    expect((error as Error).message).toContain(
      'resource "team" required by TeamBadge',
    );
    expect(fetchUser).not.toHaveBeenCalled();
  });

  it("hydrates parallel p9v server timings and preserves query metadata", async () => {
    const client = getServerQueryClient();
    client.clear();
    const makeResource = (name: "profile" | "stats" | "posts") =>
      defineResource({
        name,
        key: (id: string) => [name, id] as const,
        fetch: async (id: string) => {
          await Promise.resolve();
          return { id };
        },
      });
    const profile = makeResource("profile");
    const stats = makeResource("stats");
    const posts = makeResource("posts");
    const profileInstance = profile("u1");
    profileInstance.queryOptions.meta = { custom: "preserved" };
    const query = defineRouteQuery({
      name: "timed-profile",
      root: () => [profileInstance, stats("u1"), posts("u1")],
    });

    const element = await Prefetch({ query, params: undefined, children: null });
    const state = (element as ReactElement<{ state: unknown }>).props.state as {
      queries: Array<{ meta?: Record<string, unknown> }>;
    };
    const timingMetas = state.queries.map(
      (dehydratedQuery) => dehydratedQuery.meta?.__p9vDevtools,
    ) as Array<{
      sessionId: string;
      routeName: string;
      timings: Array<{ status: string; source: string }>;
    }>;

    expect(timingMetas).toHaveLength(3);
    expect(new Set(timingMetas.map((meta) => meta.sessionId)).size).toBe(1);
    expect(timingMetas.every((meta) => meta.routeName === "timed-profile")).toBe(
      true,
    );
    expect(timingMetas.flatMap((meta) => meta.timings)).toHaveLength(3);
    expect(
      timingMetas
        .flatMap((meta) => meta.timings)
        .every((timing) =>
          timing.status === "success" && timing.source === "server"
        ),
    ).toBe(true);
    expect(state.queries[0]?.meta?.custom).toBe("preserved");
  });

  it("records deduplicated fetches once and supports disabling server timings", async () => {
    const client = getServerQueryClient();
    client.clear();
    const resource = defineResource({
      name: "cached-profile",
      key: (id: string) => ["cached-profile", id] as const,
      fetch: async (id: string) => ({ id }),
      staleTime: 60_000,
    });
    const query = defineRouteQuery({
      root: () => [resource("u1"), resource("u1")],
    });

    const deduplicatedElement = await Prefetch({
      query,
      params: undefined,
      children: null,
    });
    const deduplicatedState = (
      deduplicatedElement as ReactElement<{ state: unknown }>
    ).props.state as {
      queries: Array<{ meta?: Record<string, unknown> }>;
    };
    const deduplicatedMeta = deduplicatedState.queries[0]?.meta
      ?.__p9vDevtools as
      | { timings: unknown[] }
      | undefined;
    expect(deduplicatedState.queries).toHaveLength(1);
    expect(deduplicatedMeta?.timings ?? []).toHaveLength(1);

    client.clear();
    const disabledElement = await Prefetch({
      query,
      params: undefined,
      children: null,
      devtools: false,
    });
    const disabledState = (
      disabledElement as ReactElement<{ state: unknown }>
    ).props.state as {
      queries: Array<{ meta?: Record<string, unknown> }>;
    };
    expect(disabledState.queries[0]?.meta?.__p9vDevtools).toBeUndefined();
  });

  it("keeps the production fallback instead of rejecting the route", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();

    try {
      const { Prefetch: ProductionPrefetch } = await import(
        "../src/server/index.js"
      );
      const fetchUser = vi.fn(async () => ({ id: "u1", name: "Ada" }));
      const userResource = defineResource({
        name: "user",
        key: (id: string) => ["user", id] as const,
        fetch: fetchUser,
      });
      const teamResource = defineResource({
        name: "team",
        key: () => ["team"] as const,
        fetch: async () => ({ name: "Core" }),
      });
      const TeamBadge: RouteComponent = Object.assign(() => null, {
        fragments: [fragment(teamResource, ["name"])],
      });
      const query = defineRouteQuery({
        root: ({ id }: { id: string }) => [userResource(id)],
        includes: [TeamBadge],
      });

      const productionElement = await ProductionPrefetch({
        query,
        params: { id: "u1" },
        children: null,
      });
      const productionState = (
        productionElement as ReactElement<{ state: unknown }>
      ).props.state as {
        queries: Array<{ meta?: Record<string, unknown> }>;
      };
      expect(fetchUser).toHaveBeenCalledOnce();
      expect(
        productionState.queries[0]?.meta?.__p9vDevtools,
      ).toBeUndefined();

      const productionOptInResource = defineResource({
        name: "production-opt-in",
        key: () => ["production-opt-in"] as const,
        fetch: async () => ({ ok: true }),
      });
      const productionOptInQuery = defineRouteQuery({
        name: "production-opt-in",
        root: () => [productionOptInResource(undefined)],
      });
      const optInElement = await ProductionPrefetch({
        query: productionOptInQuery,
        params: undefined,
        children: null,
        devtools: true,
      });
      const optInState = (
        optInElement as ReactElement<{ state: unknown }>
      ).props.state as {
        queries: Array<{ meta?: Record<string, unknown> }>;
      };
      expect(optInState.queries[0]?.meta?.__p9vDevtools).toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
