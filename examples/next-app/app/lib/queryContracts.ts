import { queryOptions } from "@tanstack/react-query";
import { defineQueryContract } from "@p9v/core";
import { apiGet, type Posts, type Stats, type User } from "./api";

export const userQuery = defineQueryContract({
  name: "user",
  options: (id: string) => queryOptions({
    queryKey: ["user", id] as const,
    queryFn: () => apiGet<User>(`/api/user/${id}`),
  }),
});

export const statsQuery = defineQueryContract({
  name: "stats",
  options: (id: string) => queryOptions({
    queryKey: ["stats", id] as const,
    queryFn: () => apiGet<Stats>(`/api/stats/${id}`),
  }),
});

export const postsQuery = defineQueryContract({
  name: "posts",
  options: (id: string) => queryOptions({
    queryKey: ["posts", id] as const,
    queryFn: () => apiGet<Posts>(`/api/posts/${id}`),
  }),
});
