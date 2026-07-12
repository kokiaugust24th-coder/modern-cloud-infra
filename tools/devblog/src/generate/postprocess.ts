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

const WO_OKONAU_PATTERN =
  /([一-龠ァ-ヶー_A-Za-z0-9]{1,12})を(行う|行った|行って|行っている|行っていた|行います|行いました|行わない)/g;

const WO_OKONAU_CONJUGATIONS: Record<string, string> = {
  行う: "する",
  行った: "した",
  行って: "して",
  行っている: "している",
  行っていた: "していた",
  行います: "します",
  行いました: "しました",
  行わない: "しない",
};

/**
 * Mechanically collapses the "〜を行う" redundant-expression pattern that
 * the LLM keeps reproducing despite style-guide instructions (e.g. "改善を
 * 行う" -> "改善する"). This mirrors the textlint ja-no-redundant-expression
 * rule so the article linter's decision is reached deterministically rather
 * than by hoping the model remembered the style guide (design.md D6).
 */
export function simplifyWoOkonauExpressions(body: string): string {
  return body.replace(WO_OKONAU_PATTERN, (_match, noun: string, conjugation: string) => `${noun}${WO_OKONAU_CONJUGATIONS[conjugation]}`);
}

/**
 * Removes the machine-generated attribution/license footer if present.
 * Used by the lint-guided repair pass: the model sees the full body (so lint
 * line numbers line up) and may echo the footer back, but the footer must
 * always be re-appended deterministically, never trusted from model output.
 */
export function stripSourceAttribution(body: string): string {
  const index = body.lastIndexOf("## 情報源");
  if (index === -1) return body;
  return `${body.slice(0, index).trimEnd()}\n`;
}

const KANJI_COUNTER_PATTERN = /([一二三四五六七八九])つ/g;

const KANJI_DIGITS: Record<string, string> = {
  一: "1",
  二: "2",
  三: "3",
  四: "4",
  五: "5",
  六: "6",
  七: "7",
  八: "8",
  九: "9",
};

/**
 * Converts the generic kanji "counter + つ" quantity idiom (一つ, 二つ, ...)
 * to arabic digits (1つ, 2つ, ...). Scoped narrowly to this single-kanji +
 * "つ" pattern — which is unambiguously a countable quantity in Japanese,
 * unlike other kanji-numeral idioms (一石二鳥 etc.) that must keep the kanji
 * form — so the replacement is always safe, unlike style-guide prompting
 * which the LLM has twice failed to follow for this exact rule.
 */
export function useArabicNumeralsForCounters(body: string): string {
  return body.replace(KANJI_COUNTER_PATTERN, (_match, digit: string) => `${KANJI_DIGITS[digit]}つ`);
}
