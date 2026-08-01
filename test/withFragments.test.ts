import { describe, expect, it } from "vitest";
import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { withFragments } from "../src/withFragments.js";

describe("withFragments", () => {
  it("preserves component identity, name, displayName, props, and tuple metadata", () => {
    const resource = defineResource({
      name: "profile",
      key: (id: string) => ["profile", id] as const,
      fetch: async (id: string) => ({ id, name: "Ada" }),
    });
    const profileFragment = fragment(resource, ["id", "name"]);
    function ProfileCard(props: { id: string }) {
      return props.id;
    }
    ProfileCard.displayName = "PublicProfileCard";

    const component = withFragments([profileFragment], ProfileCard);

    expect(component).toBe(ProfileCard);
    expect(component.name).toBe("ProfileCard");
    expect(component.displayName).toBe("PublicProfileCard");
    expect(component.fragments).toEqual([profileFragment]);
    expect(component({ id: "u1" })).toBe("u1");
    // @ts-expect-error The original component's required props are preserved.
    component({});
  });
});
