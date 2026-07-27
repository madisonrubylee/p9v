import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export const USER_FIXTURE: User = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: "https://example.com/ada.png",
};

export function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
}

export function withClient(
  client: QueryClient,
): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}
