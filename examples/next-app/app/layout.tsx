import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata = {
  title: "p9v example",
  description: "Vanilla waterfall vs p9v parallel prefetch",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          margin: 0,
          background: "#0b0d12",
          color: "#e6e9ef",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
