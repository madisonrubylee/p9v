import { defineResource } from "@p9v/core";
import { apiGet, type Posts, type Stats, type User } from "./api";

export const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: (id) => apiGet<User>(`/api/user/${id}`),
});

export const statsResource = defineResource({
  name: "stats",
  key: (id: string) => ["stats", id] as const,
  fetch: (id) => apiGet<Stats>(`/api/stats/${id}`),
});

export const postsResource = defineResource({
  name: "posts",
  key: (id: string) => ["posts", id] as const,
  fetch: (id) => apiGet<Posts>(`/api/posts/${id}`),
});
