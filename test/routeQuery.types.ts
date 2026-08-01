import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { defineRouteQuery } from "../src/routeQuery.js";
import { withFragments } from "../src/withFragments.js";
import { Prefetch } from "../src/server/index.js";

const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: async (id: string) => ({ id, name: "Ada" }),
});

const teamResource = defineResource({
  name: "team",
  key: (id: string) => ["team", id] as const,
  fetch: async (id: string) => ({ id, name: "Core" }),
});

const userFragment = fragment(userResource, ["id", "name"]);
const teamFragment = fragment(teamResource, ["id", "name"]);

function UserCard() {
  return null;
}
UserCard.fragments = [userFragment] as const;

function TeamBadge() {
  return null;
}
TeamBadge.fragments = [teamFragment] as const;

defineRouteQuery({
  root: ({ id }: { id: string }) => [
    userResource(id),
    teamResource(id),
  ],
  includes: [UserCard, TeamBadge],
});

// @ts-expect-error `teamResource` is required by TeamBadge but absent from root.
defineRouteQuery({
  root: ({ id }: { id: string }) => [userResource(id)],
  includes: [UserCard, TeamBadge],
});

const userInstance = userResource("u1");
const literalResourceName: "user" = userInstance.resourceName;
void literalResourceName;

const WrappedTeamBadge = withFragments([teamFragment], function TeamBadge(
  _props: { teamId: string },
) {
  return null;
});

defineRouteQuery({
  root: ({ id }: { id: string }) => [teamResource(id)],
  includes: [WrappedTeamBadge],
});

const typedRouteQuery = defineRouteQuery({
  root: ({ id }: { id: string }) => [userResource(id)],
});

void Prefetch({
  resources: [userResource("u1"), teamResource("t1")],
  mode: "streaming",
  children: null,
});

// @ts-expect-error direct resources and query/params are mutually exclusive.
void Prefetch({
  query: typedRouteQuery,
  params: { id: "u1" },
  resources: [userResource("u1")],
  children: null,
});

// @ts-expect-error withFragments metadata participates in completeness checks.
defineRouteQuery({
  root: ({ id }: { id: string }) => [userResource(id)],
  includes: [WrappedTeamBadge],
});
