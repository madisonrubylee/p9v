import { describe, expect, it } from "vitest";
import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { defineRouteQuery } from "../src/routeQuery.js";
import type { RouteComponent } from "../src/types.js";

const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id],
  fetch: async () => ({ id: "1", teamId: "t1" }),
});
const teamResource = defineResource({
  name: "team",
  key: (id: string) => ["team", id],
  fetch: async () => ({ id: "t1", name: "Eng" }),
});

const UserCard: RouteComponent = Object.assign(() => null, {
  fragments: [fragment(userResource, ["id"])],
});
const TeamBadge: RouteComponent = Object.assign(() => null, {
  fragments: [fragment(teamResource, ["name"])],
});

describe("defineRouteQuery", () => {
  const pageQuery = defineRouteQuery({
    name: "user-page",
    root: (params: { id: string }) => [
      userResource(params.id),
      teamResource("t1"),
    ],
    includes: [UserCard, TeamBadge],
  });

  it("returns root instances to prefetch in parallel", () => {
    const instances = pageQuery.getRootInstances({ id: "u1" });
    expect(instances).toHaveLength(2);
    expect(instances[0]!.queryKey).toEqual(["user", "u1"]);
  });

  it("collects resource names from root and included fragments", () => {
    const names = pageQuery.getResourceNames({ id: "u1" });
    expect(names).toEqual(new Set(["user", "team"]));
  });

  it("separates prefetched resources from component requirements", () => {
    expect(pageQuery.getPrefetchedResourceNames({ id: "u1" })).toEqual(
      new Set(["user", "team"]),
    );
    expect(pageQuery.requiredResources).toEqual([
      {
        componentName: "<anonymous>",
        fragmentName: "user",
        resourceName: "user",
      },
      {
        componentName: "<anonymous>",
        fragmentName: "team",
        resourceName: "team",
      },
    ]);
  });

  it("exposes name and includes", () => {
    expect(pageQuery.name).toBe("user-page");
    expect(pageQuery.includes).toHaveLength(2);
  });
});
