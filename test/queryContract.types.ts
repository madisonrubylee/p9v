import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  defineQueryContract,
  defineRouteContract,
  withQueryRequirements,
} from "../src/index.js";
import { Prefetch } from "../src/server/index.js";

const userQuery = defineQueryContract({
  name: "user",
  options: (id: string) =>
    queryOptions({
      queryKey: ["user", id] as const,
      queryFn: async () => ({ id }),
    }),
});
const teamQuery = defineQueryContract({
  name: "team",
  options: (id: string) =>
    queryOptions({
      queryKey: ["team", id] as const,
      queryFn: async () => ({ id }),
    }),
});
const feedQuery = defineQueryContract({
  name: "feed",
  options: () =>
    infiniteQueryOptions({
      queryKey: ["feed"] as const,
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => pageParam,
      getNextPageParam: (page) => page + 1,
    }),
});

const TeamBadge = withQueryRequirements([teamQuery], function TeamBadge() {
  return null;
});

const validRoute = defineRouteContract({
  load: ({ id }: { id: string }) => [
    { query: userQuery(id), policy: "blocking" },
    { query: teamQuery(id), policy: "streaming" },
    { query: feedQuery(undefined), policy: "streaming" },
  ],
  includes: [TeamBadge],
});

void Prefetch({
  contract: validRoute,
  params: { id: "u1" },
  children: null,
});

// @ts-expect-error TeamBadge requires the team contract in the route load list.
defineRouteContract({
  load: ({ id }: { id: string }) => [
    { query: userQuery(id), policy: "blocking" },
  ],
  includes: [TeamBadge],
});

void Prefetch({
  contract: validRoute,
  params: { id: "u1" },
  // @ts-expect-error route contracts own per-query policies and do not accept mode.
  mode: "blocking",
  children: null,
});
