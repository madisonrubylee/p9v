import { defineRouteContract, defineRouteQuery } from "@p9v/core";
import { postsResource, statsResource, userResource } from "./resources";
import { UserCard } from "../components/UserCard";
import { StatsPanel } from "../components/StatsPanel";
import { PostList } from "../components/PostList";
import {
  BasicPostList,
  BasicStatsPanel,
  BasicUserCard,
} from "../components/BasicProfile";
import { postsQuery, statsQuery, userQuery } from "./queryContracts";

/**
 * One declaration of everything the user page needs. All three resources are
 * keyed by `id` (route param), so they can be — and are — prefetched in
 * parallel. That is exactly what flattens the nested-component waterfall.
 */
export const userPageQuery = defineRouteQuery({
  name: "user-page",
  root: (params: { id: string }) => [
    userResource(params.id),
    statsResource(params.id),
    postsResource(params.id),
  ],
  includes: [UserCard, StatsPanel, PostList],
});

/** The 1.0 TanStack-native path with per-query server policies. */
export const streamingUserPageContract = defineRouteContract({
  name: "streaming-user-page",
  load: ({ id }: { id: string }) => [
    { query: userQuery(id), policy: "streaming" },
    { query: statsQuery(id), policy: "streaming" },
    { query: postsQuery(id), policy: "streaming" },
  ],
  includes: [BasicUserCard, BasicStatsPanel, BasicPostList],
});
