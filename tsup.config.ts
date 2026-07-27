import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
    "server/index": "src/server/index.ts",
    "devtools/index": "src/devtools/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  external: ["react", "react-dom", "@tanstack/react-query"],
  // Preserve the "use client" directive on the client entry through bundling.
  async onSuccess() {
    const { readFileSync, writeFileSync } = await import("node:fs");
    for (const file of ["dist/react.js", "dist/react.cjs"]) {
      const contents = readFileSync(file, "utf8");
      if (!contents.startsWith('"use client"')) {
        writeFileSync(file, `"use client";\n${contents}`);
      }
    }
  },
});
