import type { Article, Digest, ScanResult } from "../types.js";
import { readLedger } from "../ledger.js";
import type { DevblogConfig } from "../config.js";
import { verifyUnchangedSinceScan } from "../scan/index.js";
import type { PublishAdapter } from "./adapters/types.js";
import type { PublishRepoClient } from "./repoClient.js";

export interface PublishResult {
  created: boolean;
  reason?: string;
  pr?: { url: string; number: number };
}

const BRANCH_PREFIX = "devblog";

export function branchName(digest: Digest): string {
  return `${BRANCH_PREFIX}/${isoToSlug(digest.period.since)}--${isoToSlug(digest.period.until)}`;
}

function isoToSlug(iso: string): string {
  return iso.slice(0, 10);
}

export async function runPublish(
  config: DevblogConfig,
  article: Article,
  digest: Digest,
  scanResult: ScanResult,
  adapter: PublishAdapter,
  repoClient: PublishRepoClient
): Promise<PublishResult> {
  if (!scanResult.passed) {
    return { created: false, reason: "機密検査に合格していないため公開できません" };
  }
  if (!verifyUnchangedSinceScan(article.body, scanResult)) {
    return { created: false, reason: "検査合格後に記事本文が変更されています。再検査が必要です" };
  }

  const ledgerDuplicate = findLedgerDuplicate(config, digest);
  if (ledgerDuplicate) {
    return { created: false, reason: `既に公開済みです(${ledgerDuplicate.articleId})` };
  }

  const branch = branchName(digest);
  const existingPr = await repoClient.findOpenPrByBranchPrefix(branch);
  if (existingPr) {
    return { created: false, reason: "同一期間の PR が既に存在します", pr: { url: existingPr.url, number: existingPr.number } };
  }

  const converted = adapter.convertArticle(article, digest);
  const prBody = buildPrBody(article, digest, scanResult);

  const pr = await repoClient.createPullRequest({
    branch,
    files: [{ relativePath: converted.relativePath, content: converted.content }],
    commitMessage: `devblog: ${article.frontmatter.title}`,
    prTitle: `[devblog] ${article.frontmatter.title}`,
    prBody,
  });

  return { created: true, pr };
}

function findLedgerDuplicate(config: DevblogConfig, digest: Digest) {
  const ledger = readLedger(config.ledgerPath);
  return ledger.find(
    (entry) =>
      entry.sourcePeriod.since === digest.period.since && entry.sourcePeriod.until === digest.period.until
  );
}

function buildPrBody(article: Article, digest: Digest, scanResult: ScanResult): string {
  const changeNames = digest.openspecChanges.map((c) => `- \`${c.name}\``).join("\n") || "- なし";
  const commitCount = digest.commits.length;

  return [
    "## 概要",
    `対象期間 ${digest.period.since} 〜 ${digest.period.until} の開発ログから自動生成された下書きです。`,
    "",
    "## 対象期間",
    `${digest.period.since} 〜 ${digest.period.until}`,
    "",
    "## 情報源",
    `- コミット数: ${commitCount}`,
    "- OpenSpec チェンジ:",
    changeNames,
    "",
    "## 検査結果",
    `- 機密情報検査: ${scanResult.passed ? "合格" : "不合格"}`,
    `- 内容ハッシュ: \`${scanResult.contentHash}\``,
    "",
    "## レビューチェックリスト",
    "- [ ] 内容が事実に即しているか確認した",
    "- [ ] 機密情報が含まれていないか目視でも確認した",
    "- [ ] 必要であれば画像を追加した",
    "- [ ] このままマージして公開してよい",
  ].join("\n");
}
