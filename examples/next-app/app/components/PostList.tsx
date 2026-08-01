"use client";

import { fragment, withFragments } from "@p9v/core";
import { useFragment } from "@p9v/core/react";
import { postsResource } from "../lib/resources";
import { Card } from "./ui";

const PostList_posts = fragment(postsResource, ["items"], {
  name: "PostList",
});

export const PostList = withFragments(
  [PostList_posts],
  function PostList({ id }: { id: string }) {
    const { items } = useFragment(PostList_posts, id);
    return (
      <Card title="Recent posts">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          {items.map((post) => (
            <li key={post.id}>{post.title}</li>
          ))}
        </ul>
      </Card>
    );
  },
);
