import type { Digest, LintIssue } from "../types.js";

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
    "# 最重要: 一文の長さ",
    "情報量が多いテーマほど「1文に複数の事実を詰め込みたくなる」誘惑がありますが、これは厳禁です。",
    "1文には事実を1つだけ書いてください。「AをしたのでBになり、Cも改善した」のような文は",
    "「Aをしました。その結果Bになりました。Cも改善しました。」のように必ず分割してください。",
    "書き終えたら、句点(。)で区切った各文が概ね 40〜60 字程度に収まっているか自己チェックしてください。",
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
    "",
    "# 最重要: 機械チェック基準の遵守(必ず手順通りに実行すること)",
    "下書き本文を句点(。)で1文ずつに分解し、それぞれの文について次の3点を機械的にチェックしてください:",
    "1. 100字を超えていないか(超えていれば2文以上に分割する)",
    "2. 同じ助詞(に・が・は・の等)が2回以上使われていないか(使われていれば語順を変えるか分割する)",
    "3. 「〜を行う」「〜することができる」等の冗長表現がないか(あれば簡潔な動詞一語に置き換える)",
    "1文でもこの3点のいずれかに違反していたら、必ずその文を修正してから最終稿として出力してください。",
    "違反したまま出力すると記事リンターで機械的に不合格になります。",
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

/**
 * Lint-guided repair: instead of blindly regenerating (which failed the
 * linter 9 times in a row on information-dense digests), feed the linter's
 * actual findings back to the model so it fixes exactly the offending
 * sentences and leaves everything else untouched.
 */
export function buildRepairPrompt(body: string, issues: LintIssue[]): { system: string; prompt: string } {
  const system = [
    "あなたは技術ブログ記事の校正者です。記事リンターが検出した違反箇所だけを修正してください。",
    "",
    "# 厳守事項",
    "- 指摘された違反を全て解消すること。行番号は本文の行番号です",
    "- 「一文が長すぎる」場合はその文を句点で2〜3文に分割する",
    "- 「同じ助詞の重複」の場合は語順を変えるか文を分割する",
    "- 「冗長な表現」の場合は指摘中の提案どおり簡潔な表現に置き換える",
    "- 違反箇所以外の文章・見出し・mermaidブロック・リンクは一切変更しないこと",
    "- 新しい事実・数値・実装を追加しないこと",
    "- 出力は修正後の本文(Markdown)のみとし、説明文・前置きを含めないこと",
  ].join("\n");

  const issueLines = issues
    .map((issue) => `- [${issue.rule}]${issue.line ? ` (${issue.line}行目)` : ""} ${issue.message}`)
    .join("\n");

  const prompt = ["## リンターの指摘", issueLines, "", "## 本文", body].join("\n");

  return { system, prompt };
}
