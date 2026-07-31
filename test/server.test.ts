import { describe, expect, it, vi } from "vitest";
import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { defineRouteQuery } from "../src/routeQuery.js";
import { Prefetch } from "../src/server/index.js";
import { P9vRouteConfigError } from "../src/errors.js";
import type { RouteComponent } from "../src/types.js";

describe("Prefetch route validation", () => {
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

      await expect(
        ProductionPrefetch({
          query,
          params: { id: "u1" },
          children: null,
        }),
      ).resolves.toBeTruthy();
      expect(fetchUser).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
