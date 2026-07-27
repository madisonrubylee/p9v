"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  });
}

let browserClient: QueryClient | undefined;

function getClient() {
  if (typeof window === "undefined") return makeClient();
  return (browserClient ??= makeClient());
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(getClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
