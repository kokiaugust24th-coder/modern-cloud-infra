import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { OpenSpecChangeSummary } from "../types.js";

const EXCERPT_LENGTH = 500;

export interface OpenSpecCollectOptions {
  changesDir: string;
  since: Date;
  until: Date;
}

/**
 * Collects OpenSpec change document bodies (proposal/design) and task
 * progress. Only document text is read — never the application source
 * files the change may reference.
 */
export function collectOpenSpecChanges(options: OpenSpecCollectOptions): OpenSpecChangeSummary[] {
  let entries: string[];
  try {
    entries = readdirSync(options.changesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }

  const summaries: OpenSpecChangeSummary[] = [];

  for (const name of entries) {
    const changeDir = path.join(options.changesDir, name);
    const mtime = latestMtime(changeDir);
    if (!mtime || mtime < options.since || mtime > options.until) continue;

    const proposalPath = path.join(changeDir, "proposal.md");
    const designPath = path.join(changeDir, "design.md");
    const tasksPath = path.join(changeDir, "tasks.md");

    const proposalExcerpt = readExcerpt(proposalPath);
    const designExcerpt = readExcerpt(designPath);
    const { completedTasks, totalTasks } = countTasks(tasksPath);

    summaries.push({
      name,
      status: totalTasks === 0 ? "no-tasks" : completedTasks === totalTasks ? "complete" : "in-progress",
      completedTasks,
      totalTasks,
      proposalExcerpt: proposalExcerpt ?? "",
      designExcerpt,
    });
  }

  return summaries;
}

function latestMtime(dir: string): Date | null {
  try {
    let latest: Date | null = null;
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const mtime = statSync(full).mtime;
          if (!latest || mtime > latest) latest = mtime;
        }
      }
    };
    walk(dir);
    return latest;
  } catch {
    return null;
  }
}

function readExcerpt(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.slice(0, EXCERPT_LENGTH).trim();
  } catch {
    return null;
  }
}

function countTasks(tasksPath: string): { completedTasks: number; totalTasks: number } {
  try {
    const content = readFileSync(tasksPath, "utf-8");
    const total = content.match(/^- \[[ x]\]/gm)?.length ?? 0;
    const completed = content.match(/^- \[x\]/gm)?.length ?? 0;
    return { completedTasks: completed, totalTasks: total };
  } catch {
    return { completedTasks: 0, totalTasks: 0 };
  }
}
