import type { Digest } from "../types.js";

const IMAGE_REF_PATTERN = /!\[[^\]]*\]\((?!https?:\/\/)[^)]+\)/g;

/**
 * Appends a source list (commit range + OpenSpec change names) generated
 * deterministically from the digest — independent of the LLM's own output,
 * so it cannot be omitted or fabricated by the model.
 */
export function appendSourceAttribution(body: string, digest: Digest): string {
  const commitRange = formatCommitRange(digest);
  const changeLinks = digest.openspecChanges.map((c) => `- OpenSpec チェンジ: \`${c.name}\``).join("\n");

  const section = [
    "",
    "## 情報源",
    commitRange ? `- コミット範囲: ${commitRange}` : "- コミット範囲: なし",
    changeLinks || "- OpenSpec チェンジ: なし",
    "",
    "> この記事は開発ダイジェスト(自動収集された事実)に基づき自動生成された下書きです。無断転載・無断利用を禁止し、引用は出典明記の上で可とします。",
  ].join("\n");

  return `${body.trimEnd()}\n${section}\n`;
}

function formatCommitRange(digest: Digest): string | null {
  if (digest.commits.length === 0) return null;
  const first = digest.commits[digest.commits.length - 1].shortHash;
  const last = digest.commits[0].shortHash;
  return first === last ? first : `${first}..${last}`;
}

/** Strips any local image reference the model may have inadvertently produced (design.md D8). */
export function stripLocalImageReferences(body: string): string {
  return body.replace(IMAGE_REF_PATTERN, (match) => `<!-- 画像参照は自動生成では許可されないため削除されました: ${match} -->`);
}
