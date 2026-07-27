function baseUrl(): string {
  if (typeof window !== "undefined") return "";
  return process.env.P9V_BASE_URL ?? "http://localhost:3100";
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  teamId: string;
}

export interface Stats {
  id: string;
  followers: number;
  following: number;
  contributions: number;
}

export interface Post {
  id: string;
  title: string;
}

export interface Posts {
  items: Post[];
}
