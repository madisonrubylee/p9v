import { Prefetch } from "@p9v/core/server";
import { userPageQuery } from "../../lib/routeQuery";
import { UserCard } from "../../components/UserCard";
import { StatsPanel } from "../../components/StatsPanel";
import { PostList } from "../../components/PostList";
import { Page } from "../../components/ui";

/**
 * p9v version: `<Prefetch>` fires all three resources in parallel on the server,
 * dehydrates, and hydrates the client. The components below read from the cache
 * via `useFragment` and never trigger their own fetches.
 */
export default async function P9vUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Prefetch query={userPageQuery} params={{ id }}>
      <Page heading="p9v — parallel prefetch">
        <UserCard id={id} />
        <StatsPanel id={id} />
        <PostList id={id} />
      </Page>
    </Prefetch>
  );
}
