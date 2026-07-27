import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { useFragment } from "../src/useFragment.js";
import { P9vProvider } from "../src/context.js";
import { makeClient, USER_FIXTURE, withClient, type User } from "./helpers.js";

const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: async (id: string): Promise<User> => ({ ...USER_FIXTURE, id }),
});

describe("deferred fragments and non-strict fallback", () => {
  it("a deferred fragment fetches (suspends) instead of throwing", async () => {
    const client = makeClient();
    const deferred = fragment(userResource, ["id", "name"], {
      name: "DeferredCard",
      defer: true,
    });

    function Card() {
      const user = useFragment(deferred, "u1");
      return <div data-testid="name">{user.name}</div>;
    }

    render(
      <React.Suspense fallback={<span data-testid="loading">loading</span>}>
        <Card />
      </React.Suspense>,
      { wrapper: withClient(client) },
    );

    expect(screen.getByTestId("loading")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace"),
    );
  });

  it("non-strict mode fetches on a cache miss instead of throwing", async () => {
    const client = makeClient();
    const frag = fragment(userResource, ["id", "name"], { name: "Card" });

    function Card() {
      const user = useFragment(frag, "u1");
      return <div data-testid="name">{user.name}</div>;
    }

    render(
      <P9vProvider strict={false}>
        <React.Suspense fallback={<span>loading</span>}>
          <Card />
        </React.Suspense>
      </P9vProvider>,
      { wrapper: withClient(client) },
    );

    await waitFor(() =>
      expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace"),
    );
  });
});
