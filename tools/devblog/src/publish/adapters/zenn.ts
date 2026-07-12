import matter from "gray-matter";
import type { Article, Digest } from "../../types.js";
import type { ConvertedArticle, PublishAdapter } from "./types.js";

const TWEET_URL = /https?:\/\/(?:twitter|x)\.com\/[^/\s]+\/status\/(\d+)(?:\S*)?/g;
const YOUTUBE_URL = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=([\w-]+)\S*|youtu\.be\/([\w-]+)\S*)/g;

/**
 * Converts the platform-neutral article into Zenn's GitHub-connected repo
 * convention: `articles/<slug>.md` with Zenn's frontmatter schema, and
 * Zenn's embed shorthand for tweet/YouTube URLs (design.md D1, D8).
 */
export class ZennAdapter implements PublishAdapter {
  readonly id = "zenn";

  convertArticle(article: Article, _digest: Digest): ConvertedArticle {
    const body = convertEmbeds(article.body);

    const frontmatter = {
      title: article.frontmatter.title,
      emoji: article.frontmatter.emoji,
      type: article.frontmatter.type,
      topics: normalizeTopics(article.frontmatter.topics),
      // Merging the PR is the human approval action (design.md D1); the
      // article is authored as publish-ready and only goes live once merged.
      published: true,
    };

    const content = matter.stringify(body, frontmatter);
    return { relativePath: `articles/${article.slug}.md`, content };
  }
}

function normalizeTopics(topics: string[]): string[] {
  return topics
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 5);
}

function convertEmbeds(body: string): string {
  let converted = body.replace(TWEET_URL, (match) => `@[tweet](${match})`);
  converted = converted.replace(YOUTUBE_URL, (match) => `@[youtube](${match})`);
  return converted;
}
