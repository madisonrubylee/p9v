import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defineResource } from "../src/resource.js";
import { P9vProvider } from "../src/context.js";
import { P9vWaterfallError } from "../src/errors.js";
import { useResource } from "../src/useResource.js";
import { makeClient, USER_FIXTURE, withClient, type User } from "./helpers.js";

const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: async (id: string): Promise<User> => ({ ...USER_FIXTURE, id }),
});

class Boundary extends React.Component<
  { children: React.ReactNode; onCatch: (error: unknown) => void },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    this.props.onCatch(error);
  }

  render() {
    return this.state.error ? <span>failed</span> : this.props.children;
  }
}

describe("useResource", () => {
  it("returns the full resource type and reacts to exact-key cache updates", () => {
    const client = makeClient();
    client.setQueryData(["user", "u1"], USER_FIXTURE);

    function Card() {
      const user: User = useResource(userResource, "u1");
      return <span data-testid="user">{user.name}:{user.email}</span>;
    }

    render(<Card />, { wrapper: withClient(client) });
    expect(screen.getByTestId("user").textContent).toContain("ada@example.com");

    act(() => {
      client.setQueryData(["user", "u1"], {
        ...USER_FIXTURE,
        name: "Grace",
      });
    });
    expect(screen.getByTestId("user").textContent).toContain("Grace");
  });

  it("reports a genuine exact-key miss in strict mode", () => {
    const client = makeClient();
    client.setQueryData(["user", "u1"], USER_FIXTURE);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown;

    function Card() {
      useResource(userResource, "u2");
      return null;
    }

    render(
      <P9vProvider strict>
        <Boundary onCatch={(error) => { caught = error; }}>
          <Card />
        </Boundary>
      </P9vProvider>,
      { wrapper: withClient(client) },
    );

    expect(caught).toBeInstanceOf(P9vWaterfallError);
    expect(caught).toMatchObject({
      resourceName: "user",
      queryKey: ["user", "u2"],
    });
    spy.mockRestore();
  });

  it("reuses an existing pending query promise without fetching twice", async () => {
    const client = makeClient();
    let resolveUser!: (user: User) => void;
    const fetch = vi.fn(
      () => new Promise<User>((resolve) => { resolveUser = resolve; }),
    );
    const pendingResource = defineResource({
      name: "pending-user",
      key: (id: string) => ["pending-user", id] as const,
      fetch,
    });
    const prefetch = client.prefetchQuery(pendingResource.queryOptions("u1"));

    function Card() {
      const user = useResource(pendingResource, "u1");
      return <span data-testid="name">{user.name}</span>;
    }

    render(
      <React.Suspense fallback={<span data-testid="loading">loading</span>}>
        <Card />
      </React.Suspense>,
      { wrapper: withClient(client) },
    );

    expect(screen.getByTestId("loading")).toBeTruthy();
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => {
      resolveUser(USER_FIXTURE);
      await prefetch;
    });
    await waitFor(() =>
      expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace"),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("fetches an intentional deferred miss and suspends", async () => {
    const client = makeClient();

    function Card() {
      const user = useResource(userResource, "u3", { defer: true });
      return <span data-testid="name">{user.name}</span>;
    }

    render(
      <React.Suspense fallback={<span>loading</span>}>
        <Card />
      </React.Suspense>,
      { wrapper: withClient(client) },
    );

    await waitFor(() =>
      expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace"),
    );
  });

  it("throws a failed prefetch's original error", async () => {
    const client = makeClient();
    const failure = new Error("profile unavailable");
    const failedResource = defineResource({
      name: "failed-user",
      key: () => ["failed-user"] as const,
      fetch: async (): Promise<User> => { throw failure; },
    });
    await client.prefetchQuery(failedResource.queryOptions(undefined));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown;

    function Card() {
      useResource(failedResource, undefined);
      return null;
    }

    render(
      <Boundary onCatch={(error) => { caught = error; }}>
        <Card />
      </Boundary>,
      { wrapper: withClient(client) },
    );

    expect(caught).toBe(failure);
    spy.mockRestore();
  });
});
