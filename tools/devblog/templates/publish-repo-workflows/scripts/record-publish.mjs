// 公開用リポジトリに配置するスクリプト(scripts/record-publish.mjs としてコピーする)
// 依存パッケージなしで動作する(公開用リポジトリに devblog パッケージを含める必要をなくすため)。
//
// devblog パイプラインが作るブランチ名の規約 `devblog/<since-date>--<until-date>` から
// 対象期間を復元し、published.jsonl に 1 行追記する。

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const branch = process.env.PR_HEAD_REF;
const mergedAt = process.env.PR_MERGED_AT;
const prNumber = process.env.PR_NUMBER;

const match = /^devblog\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})$/.exec(branch ?? "");
if (!match) {
  console.error(`予期しないブランチ名です(devblog/<since>--<until> 規約に一致しません): ${branch}`);
  process.exit(1);
}

const [, since, until] = match;

const entry = {
  articleId: branch,
  publishedAt: mergedAt ?? new Date().toISOString(),
  sourcePeriod: { since, until },
  sourceCommitRange: `pr-${prNumber}`,
};

if (existsSync("published.jsonl")) {
  const existing = readFileSync("published.jsonl", "utf-8");
  if (existing.includes(`"articleId":"${branch}"`)) {
    console.log("既に台帳に記録済みです。スキップします。");
    process.exit(0);
  }
}

appendFileSync("published.jsonl", `${JSON.stringify(entry)}\n`, "utf-8");
console.log("台帳に追記しました:", entry);
