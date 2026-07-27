import { defineRouteQuery } from "p9v";
import { postsResource, statsResource, userResource } from "./resources";
import { UserCard } from "../components/UserCard";
import { StatsPanel } from "../components/StatsPanel";
import { PostList } from "../components/PostList";

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
