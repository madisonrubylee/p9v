import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { defineResource } from "../src/resource.js";
import { fragment } from "../src/fragment.js";
import { useFragment } from "../src/useFragment.js";
import { P9vProvider } from "../src/context.js";
import { P9vWaterfallError } from "../src/errors.js";
import { defineRouteQuery } from "../src/routeQuery.js";
import { RouteQueryProvider } from "../src/RouteQueryProvider.js";
import { makeClient, USER_FIXTURE, withClient, type User } from "./helpers.js";

const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: async (id: string): Promise<User> => ({ ...USER_FIXTURE, id }),
});

const cardFragment = fragment(userResource, ["id", "name"], { name: "UserCard" });

function UserCard({ id }: { id: string }) {
  const user = useFragment(cardFragment, id);
  return <div data-testid="name">{user.name}</div>;
}
UserCard.fragments = [cardFragment] as const;

describe("useFragment", () => {
  it("reads prefetched data from the cache without fetching", () => {
    const client = makeClient();
    client.setQueryData(["user", "u1"], USER_FIXTURE);

    render(<UserCard id="u1" />, { wrapper: withClient(client) });
    expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace");
  });

  it("re-renders when the cached data changes", () => {
    const client = makeClient();
    client.setQueryData(["user", "u1"], USER_FIXTURE);

    render(<UserCard id="u1" />, { wrapper: withClient(client) });
    expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace");

    act(() => {
      client.setQueryData(["user", "u1"], { ...USER_FIXTURE, name: "Grace" });
    });
    expect(screen.getByTestId("name").textContent).toBe("Grace");
  });

  it("throws a P9vWaterfallError on a cache miss in strict mode", () => {
    const client = makeClient();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    let caught: unknown;
    class Boundary extends React.Component<
      { children: React.ReactNode },
      { error: unknown }
    > {
      state = { error: null as unknown };
      static getDerivedStateFromError(error: unknown) {
        return { error };
      }
      componentDidCatch(error: unknown) {
        caught = error;
      }
      render() {
        return this.state.error ? <span>failed</span> : this.props.children;
      }
    }

    render(
      <P9vProvider strict>
        <Boundary>
          <UserCard id="missing" />
        </Boundary>
      </P9vProvider>,
      { wrapper: withClient(client) },
    );

    expect(caught).toBeInstanceOf(P9vWaterfallError);
    expect((caught as P9vWaterfallError).resourceName).toBe("user");
    spy.mockRestore();
  });

  it("detects a different query key for an otherwise prefetched resource", () => {
    const client = makeClient();
    client.setQueryData(["user", "u1"], USER_FIXTURE);
    const query = defineRouteQuery({
      name: "user-page",
      root: ({ id }: { id: string }) => [userResource(id)],
      includes: [UserCard],
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    let caught: unknown;
    class Boundary extends React.Component<
      { children: React.ReactNode },
      { error: unknown }
    > {
      state = { error: null as unknown };
      static getDerivedStateFromError(error: unknown) {
        return { error };
      }
      componentDidCatch(error: unknown) {
        caught = error;
      }
      render() {
        return this.state.error ? <span>failed</span> : this.props.children;
      }
    }

    render(
      <P9vProvider strict>
        <RouteQueryProvider query={query} params={{ id: "u1" }}>
          <Boundary>
            <UserCard id="u2" />
          </Boundary>
        </RouteQueryProvider>
      </P9vProvider>,
      { wrapper: withClient(client) },
    );

    expect(caught).toBeInstanceOf(P9vWaterfallError);
    expect((caught as P9vWaterfallError).queryKey).toEqual(["user", "u2"]);
    expect((caught as Error).message).not.toContain(
      'does not prefetch "user"',
    );
    spy.mockRestore();
  });

  it("masks undeclared fields at runtime", () => {
    const client = makeClient();
    client.setQueryData(["user", "u1"], USER_FIXTURE);

    function Leaky() {
      const user = useFragment(cardFragment, "u1") as unknown as User;
      return <div>{user.email}</div>;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<Leaky />, { wrapper: withClient(client) }),
    ).toThrow(/undeclared field "email"/);
    spy.mockRestore();
  });
});
