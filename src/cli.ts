#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeTimings,
  evaluateBudgets,
  formatReport,
  type QueryTiming,
  type WaterfallBudgetConfig,
} from "./devtools/index.js";

const DEFAULT_RECORD_FILE = "p9v.record.json";
const DEFAULT_CONFIG_FILE = "p9v.config.json";

function printUsage(): void {
  process.stdout.write(
    [
      "p9v — TanStack Query Prefetch Integrity",
      "",
      "Usage:",
      "  p9v analyze [file] [--config file]",
      "                       Analyze timings and enforce optional budgets.",
      "                       Defaults to ./p9v.record.json and ./p9v.config.json",
      "",
      "Record a session in your app:",
      "  import { WaterfallRecorder } from '@p9v/core/devtools';",
      "  const rec = new WaterfallRecorder(queryClient).start();",
      "  // ...exercise the page, then persist rec.toJSON() to p9v.record.json",
      "",
    ].join("\n") + "\n",
  );
}

function loadBudgetConfig(file: string): WaterfallBudgetConfig | null {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`[p9v] ${file} is not a valid budget config.`);
  }
  validateBudget(parsed as Record<string, unknown>, file);
  return parsed as WaterfallBudgetConfig;
}

function validateBudget(
  value: Record<string, unknown>,
  label: string,
): void {
  for (const key of [
    "maxUnexpectedWaterfalls",
    "maxDepth",
    "maxCriticalPathMs",
  ]) {
    const limit = value[key];
    if (
      limit !== undefined &&
      (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0)
    ) {
      throw new Error(`[p9v] ${label}.${key} must be a non-negative number.`);
    }
  }
  if (value.routes !== undefined) {
    if (
      !value.routes ||
      typeof value.routes !== "object" ||
      Array.isArray(value.routes)
    ) {
      throw new Error(`[p9v] ${label}.routes must be an object.`);
    }
    for (const [routeName, routeBudget] of Object.entries(value.routes)) {
      if (
        !routeBudget ||
        typeof routeBudget !== "object" ||
        Array.isArray(routeBudget)
      ) {
        throw new Error(`[p9v] ${label}.routes.${routeName} must be an object.`);
      }
      validateBudget(
        routeBudget as Record<string, unknown>,
        `${label}.routes.${routeName}`,
      );
    }
  }
}

function parseAnalyzeArgs(args: string[]): {
  recordFile: string;
  configFile: string;
} {
  let recordFile = DEFAULT_RECORD_FILE;
  let configFile = DEFAULT_CONFIG_FILE;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--config") {
      const next = args[index + 1];
      if (!next) throw new Error("[p9v] --config requires a file path.");
      configFile = next;
      index += 1;
    } else if (value?.startsWith("--")) {
      throw new Error(`[p9v] Unknown option: ${value}`);
    } else if (value) {
      recordFile = value;
    }
  }
  return { recordFile, configFile };
}

function loadTimings(file: string): QueryTiming[] {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) {
    process.stderr.write(
      `[p9v] Recording not found: ${path}\n` +
        `      Record one first (see \`p9v\` with no args) or pass a path.\n`,
    );
    process.exit(1);
  }
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    process.stderr.write(
      `[p9v] ${file} is not a p9v recording (expected an array).\n`,
    );
    process.exit(1);
  }
  return parsed as QueryTiming[];
}

function main(argv: string[]): void {
  const [command, ...args] = argv;

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    printUsage();
    return;
  }

  if (command === "analyze") {
    const { recordFile, configFile } = parseAnalyzeArgs(args);
    const timings = loadTimings(recordFile);
    const report = analyzeTimings(timings);
    process.stdout.write(formatReport(report) + "\n");
    const config = loadBudgetConfig(configFile);
    if (!config) {
      process.exitCode = report.depth > 1 ? 1 : 0;
      return;
    }
    const violations = evaluateBudgets(timings, config);
    if (violations.length > 0) {
      process.stderr.write(
        `[p9v] ${violations.length} budget violation(s):\n` +
          violations
            .map(
              ({ scope, metric, actual, maximum }) =>
                `  - ${scope}: ${metric} ${actual} > ${maximum}`,
            )
            .join("\n") +
          "\n",
      );
      process.exitCode = 1;
    } else {
      process.stdout.write("[p9v] All configured budgets passed.\n");
      process.exitCode = 0;
    }
    return;
  }

  process.stderr.write(`[p9v] Unknown command: ${command}\n\n`);
  printUsage();
  process.exit(1);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
