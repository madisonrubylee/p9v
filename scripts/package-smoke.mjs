import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const sourcePackageJson = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8"),
);
const PACKAGE_NAME = sourcePackageJson.name;
const PACKAGE_VERSION = sourcePackageJson.version;
const CACHE_DIRECTORY = join(process.cwd(), "node_modules", ".cache");

mkdirSync(CACHE_DIRECTORY, { recursive: true });
const temporaryDirectory = mkdtempSync(join(CACHE_DIRECTORY, "p9v-pack-"));

try {
  execFileSync("pnpm", ["build"], { stdio: "inherit" });
  const packOutput = execFileSync(
    "npm",
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temporaryDirectory,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_cache: join(temporaryDirectory, "npm-cache"),
      },
    },
  );
  const [packResult] = JSON.parse(packOutput);
  const packedFiles = new Set(packResult.files.map(({ path }) => path));

  for (const requiredFile of [
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/react.js",
    "dist/react.cjs",
    "dist/server/index.js",
    "dist/server/index.cjs",
    "dist/devtools/index.js",
    "dist/devtools/index.cjs",
    "dist/devtools/react.js",
    "dist/devtools/react.cjs",
    "dist/devtools/react.d.ts",
    "dist/cli.cjs",
    "MIGRATION.md",
  ]) {
    if (!packedFiles.has(requiredFile)) {
      throw new Error(`Packed artifact is missing ${requiredFile}.`);
    }
  }

  if ([...packedFiles].some((file) => file.endsWith(".DS_Store"))) {
    throw new Error("Packed artifact contains .DS_Store metadata.");
  }

  const consumerDirectory = join(temporaryDirectory, "consumer");
  const packageDirectory = join(
    consumerDirectory,
    "node_modules",
    "@p9v",
    "core",
  );
  mkdirSync(packageDirectory, { recursive: true });
  execFileSync(
    "tar",
    [
      "-xzf",
      join(temporaryDirectory, packResult.filename),
      "-C",
      packageDirectory,
      "--strip-components=1",
    ],
    { stdio: "pipe" },
  );

  const packageJson = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  if (
    packageJson.name !== PACKAGE_NAME ||
    packageJson.version !== PACKAGE_VERSION
  ) {
    throw new Error(
      `Expected ${PACKAGE_NAME}@${PACKAGE_VERSION}, received ` +
        `${packageJson.name}@${packageJson.version}.`,
    );
  }

  const entryPoints = [
    "@p9v/core",
    "@p9v/core/react",
    "@p9v/core/server",
    "@p9v/core/devtools",
    "@p9v/core/devtools/react",
  ];
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await Promise.all(${JSON.stringify(entryPoints)}.map((entry) => import(entry)));`,
    ],
    { cwd: consumerDirectory, stdio: "pipe" },
  );
  execFileSync(
    process.execPath,
    [
      "--eval",
      `${JSON.stringify(entryPoints)}.forEach((entry) => require(entry));`,
    ],
    { cwd: consumerDirectory, stdio: "pipe" },
  );

  const typeSmokeFile = join(consumerDirectory, "smoke.ts");
  writeFileSync(
    typeSmokeFile,
    [
      'import { defineQueryContract, defineRouteContract, withQueryRequirements, defineResource, defineRouteQuery, withFragments, P9vRouteConfigError, type RouteQuery } from "@p9v/core";',
      'import { RouteContractProvider, useFragment, useResource } from "@p9v/core/react";',
      'import { Prefetch } from "@p9v/core/server";',
      'import { WaterfallRecorder } from "@p9v/core/devtools";',
      'import { P9vDevtools } from "@p9v/core/devtools/react";',
      "void defineQueryContract; void defineRouteContract; void withQueryRequirements; void RouteContractProvider; void defineResource; void defineRouteQuery; void withFragments; void P9vRouteConfigError; void useFragment; void useResource;",
      "void Prefetch; void WaterfallRecorder; void P9vDevtools;",
      "type SmokeRoute = RouteQuery<{ id: string }>;",
      "const route = null as unknown as SmokeRoute; void route;",
    ].join("\n"),
  );
  execFileSync(
    join(process.cwd(), "node_modules", ".bin", "tsc"),
    [
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2021",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      typeSmokeFile,
    ],
    { cwd: consumerDirectory, stdio: "pipe" },
  );

  const reactEntry = readFileSync(
    join(packageDirectory, "dist/react.js"),
    "utf8",
  );
  if (!reactEntry.startsWith('"use client"')) {
    throw new Error('The React entry is missing its "use client" directive.');
  }
  const devtoolsReactEntry = readFileSync(
    join(packageDirectory, "dist/devtools/react.js"),
    "utf8",
  );
  if (!devtoolsReactEntry.startsWith('"use client"')) {
    throw new Error(
      'The Devtools React entry is missing its "use client" directive.',
    );
  }

  const cliOutput = execFileSync(
    process.execPath,
    [join(packageDirectory, "dist/cli.cjs"), "--help"],
    { encoding: "utf8" },
  );
  if (!cliOutput.includes("p9v — TanStack Query Prefetch Integrity")) {
    throw new Error("The packed CLI did not print its help output.");
  }

  writeFileSync(
    join(consumerDirectory, "p9v.record.json"),
    JSON.stringify([
      {
        keyHash: '["profile"]',
        key: ["profile"],
        resource: "profile",
        owner: null,
        startedAt: 0,
        settledAt: 100,
        status: "success",
        sessionId: "server:smoke",
        routeName: "profile",
        classification: "prefetched",
      },
    ]),
  );
  writeFileSync(
    join(consumerDirectory, "p9v.config.json"),
    JSON.stringify({ maxUnexpectedWaterfalls: 0, maxDepth: 1 }),
  );
  const analyzeOutput = execFileSync(
    process.execPath,
    [join(packageDirectory, "dist/cli.cjs"), "analyze"],
    { cwd: consumerDirectory, encoding: "utf8" },
  );
  if (!analyzeOutput.includes("All configured budgets passed")) {
    throw new Error("The packaged CLI did not enforce the passing budget.");
  }

  writeFileSync(
    join(consumerDirectory, "p9v.record.json"),
    JSON.stringify([
      {
        keyHash: '["profile"]',
        key: ["profile"],
        resource: "profile",
        owner: null,
        startedAt: 0,
        settledAt: 100,
        status: "error",
        sessionId: "client:smoke",
        routeName: "profile",
        classification: "unexpected-waterfall",
      },
    ]),
  );
  writeFileSync(
    join(consumerDirectory, "p9v.config.json"),
    JSON.stringify({ maxUnexpectedWaterfalls: 0 }),
  );
  const failedBudget = spawnSync(
    process.execPath,
    [join(packageDirectory, "dist/cli.cjs"), "analyze"],
    { cwd: consumerDirectory, encoding: "utf8" },
  );
  if (failedBudget.status !== 1 || !failedBudget.stderr.includes("budget violation")) {
    throw new Error("The packaged CLI did not fail a violated budget.");
  }

  process.stdout.write(
    `Package smoke test passed for ${PACKAGE_NAME}@${PACKAGE_VERSION}.\n`,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
