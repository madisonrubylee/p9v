import { describe, expect, it, vi } from "vitest";
import { defineResource } from "../src/resource.js";
import type { User } from "./helpers.js";

describe("defineResource", () => {
  const userResource = defineResource({
    name: "user",
    key: (id: string) => ["user", id] as const,
    fetch: async (id: string): Promise<User> => ({
      id,
      name: "x",
      email: "x@x",
      avatarUrl: "x",
    }),
    staleTime: 1234,
  });

  it("exposes name, key, and query options", () => {
    expect(userResource.resourceName).toBe("user");
    expect(userResource.key("u1")).toEqual(["user", "u1"]);

    const options = userResource.queryOptions("u1");
    expect(options.queryKey).toEqual(["user", "u1"]);
    expect(options.staleTime).toBe(1234);
    expect(typeof options.queryFn).toBe("function");
  });

  it("produces a resource instance when called", () => {
    const instance = userResource("u1");
    expect(instance.__p9vResourceInstance).toBe(true);
    expect(instance.resourceName).toBe("user");
    expect(instance.queryKey).toEqual(["user", "u1"]);
  });

  it("passes the abort signal through to fetch", async () => {
    const fetchSpy = vi.fn(async () => 42);
    const numberResource = defineResource({
      name: "number",
      key: () => ["number"],
      fetch: fetchSpy,
    });
    const controller = new AbortController();
    const options = numberResource.queryOptions(undefined);
    await (options.queryFn as (ctx: { signal: AbortSignal }) => Promise<number>)(
      { signal: controller.signal },
    );
    expect(fetchSpy).toHaveBeenCalledWith(undefined, {
      signal: controller.signal,
    });
  });
});
