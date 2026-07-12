export interface CommitSummary {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  changedFiles: string[];
  insertions: number;
  deletions: number;
}

export interface OpenSpecChangeSummary {
  name: string;
  status: "in-progress" | "no-tasks" | "complete" | "archived";
  completedTasks: number;
  totalTasks: number;
  proposalExcerpt: string;
  designExcerpt: string | null;
}

export interface DevlogEntry {
  date: string;
  sourcePath: string;
  body: string;
  referenceUrls: string[];
  embedCandidateUrls: string[];
}

export interface Digest {
  period: {
    since: string;
    until: string;
  };
  generatedAt: string;
  commits: CommitSummary[];
  openspecChanges: OpenSpecChangeSummary[];
  devlogEntries: DevlogEntry[];
  isEmpty: boolean;
}

export interface GenerationMetadata {
  model: string;
  generatedAt: string;
  stages: {
    outline: { inputTokens: number; outputTokens: number };
    draft: { inputTokens: number; outputTokens: number };
    critique: { inputTokens: number; outputTokens: number };
  };
  templateVersion: string;
  rubricVersion: string;
}

export interface ArticleFrontmatter {
  title: string;
  emoji: string;
  type: "tech" | "idea";
  topics: string[];
  published: boolean;
  source_period: string;
  source_commits: string;
  template_version: string;
  rubric_version: string;
  [key: string]: unknown;
}

export interface Article {
  frontmatter: ArticleFrontmatter;
  body: string;
  slug: string;
}

export interface LintIssue {
  rule: string;
  message: string;
  line?: number;
}

export interface LintResult {
  passed: boolean;
  issues: LintIssue[];
}

export interface ScanFinding {
  pattern: string;
  line: number;
  excerpt: string;
}

export interface ScanResult {
  passed: boolean;
  findings: ScanFinding[];
  contentHash: string;
}

export interface AllowlistEntry {
  fingerprint: string;
  reason: string;
  addedBy: string;
  addedAt: string;
}

export interface LedgerEntry {
  articleId: string;
  publishedAt: string;
  sourcePeriod: { since: string; until: string };
  sourceCommitRange: string;
}
