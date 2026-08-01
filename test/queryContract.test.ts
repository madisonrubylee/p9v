import {
  infiniteQueryOptions,
  queryOptions,
} from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { P9vWaterfallError } from "../src/errors.js";
import { defineQueryContract } from "../src/queryContract.js";
import { makeClient } from "./helpers.js";

describe("defineQueryContract", () => {
  it("preserves TanStack options and rejects an unexpected browser cache miss", async () => {
    const fetchUser = vi.fn(async (id: string) => ({ id }));
    const userQuery = defineQueryContract({
      name: "user",
      options: (id: string) =>
        queryOptions({
          queryKey: ["user", id] as const,
          queryFn: () => fetchUser(id),
          staleTime: 10_000,
        }),
    });

    const options = userQuery("u1");
    expect(options.queryKey).toEqual(["user", "u1"]);
    expect(options.staleTime).toBe(10_000);
    await expect(makeClient().fetchQuery(options)).rejects.toBeInstanceOf(
      P9vWaterfallError,
    );
    expect(fetchUser).not.toHaveBeenCalled();
  });

  it("allows an explicitly deferred client query", async () => {
    const userQuery = defineQueryContract({
      name: "deferred-user",
      options: (id: string) =>
        queryOptions({
          queryKey: ["deferred-user", id] as const,
          queryFn: async () => ({ id }),
        }),
    });

    await expect(
      makeClient().fetchQuery(userQuery("u1", { defer: true })),
    ).resolves.toEqual({ id: "u1" });
  });

  it("preserves infinite query options", () => {
    const feedQuery = defineQueryContract({
      name: "feed",
      options: (id: string) =>
        infiniteQueryOptions({
          queryKey: ["feed", id] as const,
          initialPageParam: 0,
          queryFn: async ({ pageParam }) => ({ id, page: pageParam }),
          getNextPageParam: (lastPage) => lastPage.page + 1,
        }),
    });

    const options = feedQuery("main");
    expect(options.initialPageParam).toBe(0);
    expect(options.queryKey).toEqual(["feed", "main"]);
  });

  it("keeps the safe client fetch fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { defineQueryContract: defineProductionQueryContract } = await import(
        "../src/queryContract.js"
      );
      const productionQuery = defineProductionQueryContract({
        name: "production-profile",
        options: (id: string) => queryOptions({
          queryKey: ["production-profile", id] as const,
          queryFn: async () => ({ id }),
        }),
      });
      await expect(
        makeClient().fetchQuery(productionQuery("u1")),
      ).resolves.toEqual({ id: "u1" });
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
