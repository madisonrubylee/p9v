"use client";

import { useResource } from "@p9v/core/react";
import {
  postsResource,
  statsResource,
  userResource,
} from "../lib/resources";
import { Card } from "./ui";

export function BasicUserCard({ id }: { id: string }) {
  const user = useResource(userResource, id);
  return (
    <Card title="Profile">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatarUrl}
          alt=""
          width={56}
          height={56}
          style={{ borderRadius: "50%" }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: 18 }}>{user.name}</div>
          <div style={{ opacity: 0.6, fontSize: 13 }}>#{user.id}</div>
        </div>
      </div>
    </Card>
  );
}

export function BasicStatsPanel({ id }: { id: string }) {
  const stats = useResource(statsResource, id);
  return (
    <Card title="Stats">
      <div style={{ display: "flex", gap: 24 }}>
        <Metric label="Followers" value={stats.followers} />
        <Metric label="Following" value={stats.following} />
        <Metric label="Contributions" value={stats.contributions} />
      </div>
    </Card>
  );
}

export function BasicPostList({ id }: { id: string }) {
  const posts = useResource(postsResource, id);
  return (
    <Card title="Recent posts">
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
        {posts.items.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ opacity: 0.6, fontSize: 12 }}>{label}</div>
    </div>
  );
}
