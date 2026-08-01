import { queryOptions } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { defineQueryContract } from "../src/queryContract.js";
import { defineRouteContract } from "../src/routeContract.js";
import { withQueryRequirements } from "../src/withQueryRequirements.js";

const userQuery = defineQueryContract({
  name: "user",
  options: (id: string) =>
    queryOptions({
      queryKey: ["user", id] as const,
      queryFn: async () => ({ id }),
    }),
});

const UserCard = withQueryRequirements(
  [userQuery],
  Object.assign(function UserCard() {
    return null;
  }, { displayName: "UserCard" }),
);

describe("defineRouteContract", () => {
  const route = defineRouteContract({
    name: "user-page",
    load: ({ id }: { id: string }) => [
      { query: userQuery(id), policy: "blocking" },
    ],
    includes: [UserCard],
  });

  it("exposes query requirements and exact prefetched keys", () => {
    expect(route.requiredQueries).toEqual([
      { queryName: "user", componentName: "UserCard" },
    ]);
    expect(route.getPrefetchedQueryKeys({ id: "u1" })).toEqual([
      ["user", "u1"],
    ]);
    expect(route.getPrefetchedQueryHashes({ id: "u1" })).toEqual(
      new Set(['["user","u1"]']),
    );
  });
});
