import type { Digest } from "../types.js";

export interface TemplateAssets {
  articleTemplate: string;
  styleGuide: string;
  rubric: string;
  templateVersion: string;
  rubricVersion: string;
}

/** Renders the digest as plain facts only — this text is the sole source of truth the LLM may draw from. */
export function renderDigestFacts(digest: Digest): string {
  const commitLines = digest.commits
    .map((c) => `- [${c.shortHash}] ${c.message} (files: ${c.changedFiles.join(", ") || "なし"}, +${c.insertions}/-${c.deletions})`)
    .join("\n");

  const changeLines = digest.openspecChanges
    .map((c) => {
      const design = c.designExcerpt ? `\n  design抜粋: ${c.designExcerpt}` : "";
      return `- ${c.name} (${c.status}, タスク ${c.completedTasks}/${c.totalTasks})\n  proposal抜粋: ${c.proposalExcerpt}${design}`;
    })
    .join("\n");

  const devlogLines = digest.devlogEntries
    .map((e) => `- ${e.date}:\n${indent(e.body)}`)
    .join("\n");

  return [
    `対象期間: ${digest.period.since} 〜 ${digest.period.until}`,
    "",
    "## コミット一覧",
    commitLines || "(なし)",
    "",
    "## OpenSpec チェンジ",
    changeLines || "(なし)",
    "",
    "## 開発メモ",
    devlogLines || "(なし)",
  ].join("\n");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

export function buildOutlinePrompt(digest: Digest, assets: TemplateAssets): { system: string; prompt: string } {
  const system = [
    "あなたは開発ログをもとに技術ブログ記事の構成案を作る編集者です。",
    "以下のスタイルガイドと記事テンプレートに厳密に従ってください。",
    "ダイジェストに書かれていない事実・数値・実装を絶対に創作しないでください。",
    "",
    "# スタイルガイド",
    assets.styleGuide,
    "",
    "# 記事テンプレート",
    assets.articleTemplate,
  ].join("\n");

  const prompt = [
    "以下は開発ダイジェスト(この期間の事実の全て)です。これに基づき、記事の構成案を JSON で出力してください。",
    "出力は次のスキーマの JSON のみ(説明文・コードフェンス不要):",
    '{"title": string, "targetReader": string, "themes": [{"heading": string, "summary": string, "needsDiagram": boolean}]}',
    "",
    renderDigestFacts(digest),
  ].join("\n");

  return { system, prompt };
}

export function buildDraftPrompt(
  digest: Digest,
  assets: TemplateAssets,
  outline: string
): { system: string; prompt: string } {
  const system = [
    "あなたは開発ログをもとに技術ブログ記事の本文を書くライターです。",
    "スタイルガイドと記事テンプレートに厳密に従い、日本語の Markdown 本文のみを出力してください(frontmatterは不要)。",
    "ダイジェストに書かれていない事実・数値・実装を絶対に創作しないでください。",
    "構造的な変更を扱うテーマには mermaid コードブロックを含めてください。画像ファイルへの参照は絶対に含めないでください。",
    "",
    "# スタイルガイド",
    assets.styleGuide,
    "",
    "# 記事テンプレート",
    assets.articleTemplate,
  ].join("\n");

  const prompt = [
    "以下の構成案とダイジェストに基づき、記事本文(Markdown)を書いてください。",
    "",
    "## 構成案",
    outline,
    "",
    "## ダイジェスト",
    renderDigestFacts(digest),
  ].join("\n");

  return { system, prompt };
}

export function buildCritiquePrompt(
  digest: Digest,
  assets: TemplateAssets,
  draftBody: string
): { system: string; prompt: string } {
  const system = [
    "あなたは技術ブログ記事の校閲者です。以下の品質ルーブリックに基づいて下書きを自己採点し、",
    "「要修正」の観点があれば修正した最終稿を出力してください。修正が不要でも、下書きをそのまま最終稿として出力してください。",
    "出力は修正後の本文(Markdown)のみとし、採点結果や説明文は含めないでください。",
    "ダイジェストに書かれていない事実・数値・実装を絶対に創作しないでください。画像ファイルへの参照は含めないでください。",
    "スタイルガイドの「文章の機械チェック基準」に違反する文(100字を超える一文、",
    "同じ助詞の連続、冗長表現)があれば必ず修正してください。これは記事リンターで機械検証されます。",
    "",
    "# スタイルガイド",
    assets.styleGuide,
    "",
    "# 品質ルーブリック",
    assets.rubric,
  ].join("\n");

  const prompt = [
    "## 下書き",
    draftBody,
    "",
    "## ダイジェスト(事実確認用)",
    renderDigestFacts(digest),
  ].join("\n");

  return { system, prompt };
}
