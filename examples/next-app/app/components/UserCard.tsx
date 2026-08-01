"use client";

import { fragment, withFragments } from "@p9v/core";
import { useFragment } from "@p9v/core/react";
import { userResource } from "../lib/resources";
import { Card } from "./ui";

const UserCard_user = fragment(userResource, ["id", "name", "avatarUrl"], {
  name: "UserCard",
});

export const UserCard = withFragments(
  [UserCard_user],
  function UserCard({ id }: { id: string }) {
    const user = useFragment(UserCard_user, id);
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
  },
);
