#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeTimings,
  formatReport,
  type QueryTiming,
} from "./devtools/index.js";

const DEFAULT_RECORD_FILE = "p9v.record.json";

function printUsage(): void {
  process.stdout.write(
    [
      "p9v — Prefetch → View",
      "",
      "Usage:",
      "  p9v analyze [file]   Analyze a recorded session and print the waterfall report.",
      "                       Defaults to ./p9v.record.json",
      "",
      "Record a session in your app:",
      "  import { WaterfallRecorder } from 'p9v/devtools';",
      "  const rec = new WaterfallRecorder(queryClient).start();",
      "  // ...exercise the page, then persist rec.toJSON() to p9v.record.json",
      "",
    ].join("\n") + "\n",
  );
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
    process.stderr.write(`[p9v] ${file} is not a p9v recording (expected an array).\n`);
    process.exit(1);
  }
  return parsed as QueryTiming[];
}

function main(argv: string[]): void {
  const [command, arg] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "analyze") {
    const timings = loadTimings(arg ?? DEFAULT_RECORD_FILE);
    const report = analyzeTimings(timings);
    process.stdout.write(formatReport(report) + "\n");
    process.exitCode = report.depth > 1 ? 1 : 0;
    return;
  }

  process.stderr.write(`[p9v] Unknown command: ${command}\n\n`);
  printUsage();
  process.exit(1);
}

main(process.argv.slice(2));
