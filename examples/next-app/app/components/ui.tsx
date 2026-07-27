import type { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "#151924",
        border: "1px solid #232838",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 13, letterSpacing: 1, opacity: 0.5, textTransform: "uppercase" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Page({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>{heading}</h1>
      {children}
    </main>
  );
}
