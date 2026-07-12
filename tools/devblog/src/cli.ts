#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import matter from "gray-matter";
import { loadConfig } from "./config.js";
import { runCollect } from "./collect/index.js";
import { runGenerate } from "./generate/index.js";
import { createLlmClient } from "./generate/providers/factory.js";
import { runScan, writeScanResult } from "./scan/index.js";
import { runPublish } from "./publish/index.js";
import { GhPublishRepoClient } from "./publish/repoClient.js";
import { ZennAdapter } from "./publish/adapters/zenn.js";
import { appendLedgerEntry } from "./ledger.js";
import type { Article, Digest, ScanResult } from "./types.js";

const program = new Command();
program.name("devblog").description("開発ログからブログ下書き PR を作るパイプライン CLI");

program
  .command("collect")
  .description("開発情報を収集してダイジェストを出力する")
  .option("--since <iso>", "収集対象期間の開始 (ISO 日時)")
  .option("--until <iso>", "収集対象期間の終了 (ISO 日時)")
  .option("--force", "公開履歴を無視して指定期間全体を収集する", false)
  .action((opts) => {
    const config = loadConfig();
    const { digest, digestPath } = runCollect(config, { since: opts.since, until: opts.until, force: opts.force });

    if (digest.isEmpty) {
      console.log("対象期間に活動がありません。後段はスキップします。");
      process.exitCode = 2;
      return;
    }

    console.log(`ダイジェストを出力しました: ${digestPath}`);
  });

program
  .command("generate")
  .description("ダイジェストから記事下書きを生成する")
  .requiredOption("--digest <path>", "collect が出力したダイジェスト JSON のパス")
  .action(async (opts) => {
    const config = loadConfig();
    const digest = JSON.parse(readFileSync(opts.digest, "utf-8")) as Digest;

    let llm;
    try {
      llm = createLlmClient(config.llm);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }

    const result = await runGenerate(config, digest, llm);

    if (!result.article) {
      console.log("生成対象がありません(空のダイジェスト)。");
      return;
    }

    console.log(`下書きを出力しました: ${result.draftPath}`);
    if (!result.lint?.passed) {
      console.error("記事リンターに不合格です:");
      for (const issue of result.lint?.issues ?? []) {
        console.error(`  [${issue.rule}] ${issue.message}${issue.line ? ` (line ${issue.line})` : ""}`);
      }
      process.exitCode = 3;
    }
  });

program
  .command("scan")
  .description("記事下書きの機密情報検査を行う")
  .requiredOption("--article <path>", "検査対象の記事 Markdown ファイルのパス")
  .action((opts) => {
    const config = loadConfig();
    const content = readFileSync(opts.article, "utf-8");
    const slug = path.basename(opts.article, ".md");

    const result = runScan(config, content);
    const resultPath = writeScanResult(config, slug, result);

    if (!result.passed) {
      console.error(`機密情報検査に不合格です(${resultPath}):`);
      for (const finding of result.findings) {
        console.error(`  [${finding.pattern}] line ${finding.line}: ${finding.excerpt}`);
      }
      process.exitCode = 4;
      return;
    }

    console.log(`検査に合格しました: ${resultPath}`);
  });

program
  .command("publish")
  .description("検査合格済みの記事を公開用リポジトリへ PR として提出する")
  .requiredOption("--article <path>", "記事 Markdown ファイルのパス")
  .requiredOption("--digest <path>", "対応するダイジェスト JSON のパス")
  .requiredOption("--scan <path>", "対応する scan 結果 JSON のパス")
  .action(async (opts) => {
    const config = loadConfig();

    const raw = readFileSync(opts.article, "utf-8");
    const parsed = matter(raw);
    const slug = path.basename(opts.article, ".md");
    const article: Article = { frontmatter: parsed.data as Article["frontmatter"], body: parsed.content, slug };

    const digest = JSON.parse(readFileSync(opts.digest, "utf-8")) as Digest;
    const scanResult = JSON.parse(readFileSync(opts.scan, "utf-8")) as ScanResult;

    const repo = process.env[config.publishRepoEnvVar];
    const token = process.env[config.publishRepoTokenEnvVar];
    if (!repo || !token) {
      console.error(`${config.publishRepoEnvVar} / ${config.publishRepoTokenEnvVar} が設定されていません。`);
      process.exitCode = 1;
      return;
    }

    const repoClient = new GhPublishRepoClient({ repo, token });
    const result = await runPublish(config, article, digest, scanResult, new ZennAdapter(), repoClient);

    if (!result.created) {
      console.log(`公開をスキップしました: ${result.reason}`);
      if (result.pr) console.log(`既存 PR: ${result.pr.url}`);
      return;
    }

    console.log(`PR を作成しました: ${result.pr?.url}`);
  });

program
  .command("run")
  .description("collect -> generate -> scan -> publish を直列実行する(CI 用)")
  .option("--since <iso>")
  .option("--until <iso>")
  .action(async (opts) => {
    const config = loadConfig();
    const { digest, digestPath } = runCollect(config, { since: opts.since, until: opts.until });

    if (digest.isEmpty || !digestPath) {
      console.log("対象期間に活動がありません。パイプラインを終了します。");
      return;
    }

    const llm = createLlmClient(config.llm);

    const generateResult = await runGenerate(config, digest, llm);
    if (!generateResult.article || !generateResult.draftPath) {
      console.log("生成対象がありません。");
      return;
    }
    if (!generateResult.lint?.passed) {
      console.error(`記事リンターに不合格のため公開フローを中断します(下書き: ${generateResult.draftPath}):`);
      for (const issue of generateResult.lint?.issues ?? []) {
        console.error(`  [${issue.rule}] ${issue.message}${issue.line ? ` (line ${issue.line})` : ""}`);
      }
      process.exitCode = 3;
      return;
    }

    const scanResult = runScan(config, generateResult.article.body);
    writeScanResult(config, generateResult.article.slug, scanResult);
    if (!scanResult.passed) {
      console.error("機密情報検査に不合格のため公開フローを中断します。");
      process.exitCode = 4;
      return;
    }

    const repo = process.env[config.publishRepoEnvVar];
    const token = process.env[config.publishRepoTokenEnvVar];
    if (!repo || !token) throw new Error(`${config.publishRepoEnvVar} / ${config.publishRepoTokenEnvVar} が設定されていません。`);

    const repoClient = new GhPublishRepoClient({ repo, token });
    const publishResult = await runPublish(config, generateResult.article, digest, scanResult, new ZennAdapter(), repoClient);

    if (!publishResult.created) {
      console.log(`公開をスキップしました: ${publishResult.reason}`);
      return;
    }

    console.log(`PR を作成しました: ${publishResult.pr?.url}`);
  });

program
  .command("record-ledger")
  .description("(本リポジトリ側の動作確認用) 台帳への手動追記")
  .requiredOption("--article-id <id>")
  .requiredOption("--since <iso>")
  .requiredOption("--until <iso>")
  .requiredOption("--commit-range <range>")
  .action((opts) => {
    const config = loadConfig();
    appendLedgerEntry(config.ledgerPath, {
      articleId: opts.articleId,
      publishedAt: new Date().toISOString(),
      sourcePeriod: { since: opts.since, until: opts.until },
      sourceCommitRange: opts.commitRange,
    });
    console.log("台帳に追記しました。");
  });

program.parseAsync(process.argv);
