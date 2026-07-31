"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type Posts, type Stats, type User } from "../lib/api";
import { Card, Page } from "./ui";

export function ClientWaterfall({ id }: { id: string }) {
  const userQuery = useQuery({
    queryKey: ["client-demo-user", id],
    queryFn: () => apiGet<User>(`/api/user/${id}`),
  });

  if (userQuery.isPending) return <Loading label="Loading user…" />;
  if (userQuery.isError) return <Failure error={userQuery.error} />;

  const user = userQuery.data;
  return (
    <Page heading="Client — nested React Query waterfall">
      <Card title="Profile">
        <div style={{ fontWeight: 600, fontSize: 18 }}>{user.name}</div>
        <div style={{ opacity: 0.6, fontSize: 13 }}>#{user.id}</div>
      </Card>
      <ClientStats id={id} />
    </Page>
  );
}

function ClientStats({ id }: { id: string }) {
  const statsQuery = useQuery({
    queryKey: ["client-demo-stats", id],
    queryFn: () => apiGet<Stats>(`/api/stats/${id}`),
  });

  if (statsQuery.isPending) return <Loading label="Loading stats…" />;
  if (statsQuery.isError) return <Failure error={statsQuery.error} />;

  const stats = statsQuery.data;
  return (
    <>
      <Card title="Stats">
        <div style={{ display: "flex", gap: 24 }}>
          <span>{stats.followers.toLocaleString()} followers</span>
          <span>{stats.contributions.toLocaleString()} contributions</span>
        </div>
      </Card>
      <ClientPosts id={id} />
    </>
  );
}

function ClientPosts({ id }: { id: string }) {
  const postsQuery = useQuery({
    queryKey: ["client-demo-posts", id],
    queryFn: () => apiGet<Posts>(`/api/posts/${id}`),
  });

  if (postsQuery.isPending) return <Loading label="Loading posts…" />;
  if (postsQuery.isError) return <Failure error={postsQuery.error} />;

  return (
    <Card title="Recent posts">
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
        {postsQuery.data.items.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </Card>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
      {label}
    </div>
  );
}

function Failure({ error }: { error: Error }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
      Request failed: {error.message}
    </div>
  );
}
