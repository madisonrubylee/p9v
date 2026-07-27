"use client";

import { fragment } from "p9v";
import { useFragment } from "p9v/react";
import { statsResource } from "../lib/resources";
import { Card } from "./ui";

const StatsPanel_stats = fragment(
  statsResource,
  ["followers", "following", "contributions"],
  { name: "StatsPanel" },
);

export function StatsPanel({ id }: { id: string }) {
  const stats = useFragment(StatsPanel_stats, id);
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
StatsPanel.fragments = [StatsPanel_stats] as const;

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
