import type { Article, Digest } from "../../types.js";

export interface ConvertedArticle {
  /** Path relative to the publish repository root. */
  relativePath: string;
  content: string;
}

/**
 * Abstracts the publish destination so the pipeline core never depends on a
 * specific platform's conventions (design.md D1). Git-based platforms are
 * the only supported family for now — this interface exists so a future
 * platform (or a second Git-based one) doesn't require touching pipeline code.
 */
export interface PublishAdapter {
  readonly id: string;
  convertArticle(article: Article, digest: Digest): ConvertedArticle;
}
