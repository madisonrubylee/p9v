import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { defineRouteQuery } from "../src/routeQuery.js";

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
