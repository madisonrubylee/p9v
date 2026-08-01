import { Suspense } from "react";
import { Prefetch } from "@p9v/core/server";
import { streamingUserPageContract } from "../../lib/routeQuery";
import {
  BasicPostList,
  BasicStatsPanel,
  BasicUserCard,
} from "../../components/BasicProfile";
import { Page } from "../../components/ui";

function LoadingCard({ label }: { label: string }) {
  return <p aria-label={`${label} loading`}>Loading {label}…</p>;
}

export default async function StreamingUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Prefetch contract={streamingUserPageContract} params={{ id }} devtools>
      <Page heading="p9v — Suspense streaming">
        <Suspense fallback={<LoadingCard label="profile" />}>
          <BasicUserCard id={id} />
        </Suspense>
        <Suspense fallback={<LoadingCard label="stats" />}>
          <BasicStatsPanel id={id} />
        </Suspense>
        <Suspense fallback={<LoadingCard label="posts" />}>
          <BasicPostList id={id} />
        </Suspense>
      </Page>
    </Prefetch>
  );
}
