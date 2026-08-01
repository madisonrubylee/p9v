import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { P9vDevtools } from "../src/devtools/react.js";
import {
  createP9vDevtoolsMeta,
  withP9vDevtoolsMeta,
} from "../src/devtools/index.js";
import { makeClient } from "./helpers.js";

function renderDevtools(
  client = makeClient(),
  props: React.ComponentProps<typeof P9vDevtools> = {},
) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <P9vDevtools {...props} />
      </QueryClientProvider>,
    ),
  };
}

describe("P9vDevtools", () => {
  it("opens, closes with Escape, and supports disabled rendering", () => {
    const { rerender, client } = renderDevtools();
    fireEvent.click(screen.getByRole("button", { name: "Open p9v Devtools" }));
    expect(screen.getByRole("complementary", { name: "p9v Devtools" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "p9v Devtools" })).toBeNull();

    rerender(
      <QueryClientProvider client={client}>
        <P9vDevtools enabled={false} />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Open p9v Devtools" })).toBeNull();
  });

  it("renders hydrated server sessions", async () => {
    const client = makeClient();
    const meta = createP9vDevtoolsMeta({
      sessionId: "server:test",
      routeName: "profile-page",
    });
    meta.timings.push({
      id: "server:test:profile",
      keyHash: '["profile","u1"]',
      key: ["profile", "u1"],
      resource: "profile",
      owner: null,
      startedAt: 100,
      settledAt: 500,
      status: "success",
      source: "server",
      sessionId: "server:test",
      routeName: "profile-page",
      classification: "prefetched",
    });
    client.setQueryDefaults(["profile", "u1"], {
      meta: withP9vDevtoolsMeta(undefined, meta),
    });
    client.setQueryData(["profile", "u1"], { id: "u1" });

    renderDevtools(client, { initialIsOpen: true });
    expect(
      await screen.findByRole("option", {
        name: "Server · profile-page · 1 queries",
      }),
    ).toBeTruthy();
    expect(screen.getByText("No suspected waterfall in this session")).toBeTruthy();
    expect(screen.getByTitle("profile")).toBeTruthy();
    expect(screen.getByText("prefetched")).toBeTruthy();
  });

  it("shows a suspected client waterfall, copies JSON, and clears only timings", async () => {
    const client = makeClient();
    const writeText = vi.fn<(text: string) => Promise<void>>(
      async () => undefined,
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDevtools(client, {
      initialIsOpen: true,
      sequentialThresholdMs: 100,
    });

    await act(async () => {
      await client.fetchQuery({ queryKey: ["first"], queryFn: async () => 1 });
      await client.fetchQuery({ queryKey: ["second"], queryFn: async () => 2 });
    });

    expect(await screen.findByText("Suspected waterfall · depth 2")).toBeTruthy();
    expect(screen.getByTitle("first")).toBeTruthy();
    expect(screen.getByTitle("second")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    });
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain('"source": "client"');

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Waiting for p9v or TanStack Query requests…")).toBeTruthy();
    expect(client.getQueryData(["first"])).toBe(1);
    expect(client.getQueryData(["second"])).toBe(2);
  });

  it("is disabled by default in production but supports explicit opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { P9vDevtools: ProductionDevtools } = await import(
        "../src/devtools/react.js"
      );
      expect(ProductionDevtools({})).toBeNull();
      expect(ProductionDevtools({ enabled: true })).not.toBeNull();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("renders pending and error query states", async () => {
    const client = makeClient();
    renderDevtools(client, { initialIsOpen: true });
    let resolvePending: ((value: string) => void) | undefined;

    let pendingRequest: Promise<string> | undefined;
    act(() => {
      pendingRequest = client.fetchQuery({
        queryKey: ["pending-query"],
        queryFn: () =>
          new Promise<string>((resolve) => {
            resolvePending = resolve;
          }),
      });
    });
    expect(await screen.findByText("pending")).toBeTruthy();

    await act(async () => {
      resolvePending?.("done");
      await pendingRequest;
    });

    await act(async () => {
      await expect(
        client.fetchQuery({
          queryKey: ["failed-query"],
          queryFn: async () => {
            throw new Error("expected failure");
          },
        }),
      ).rejects.toThrow("expected failure");
    });
    expect(await screen.findByText("error")).toBeTruthy();
    expect(screen.getByTitle("failed-query")).toBeTruthy();
  });
});
