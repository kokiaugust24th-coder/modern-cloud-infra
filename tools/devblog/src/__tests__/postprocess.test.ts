import { describe, it, expect } from "vitest";
import {
  simplifyWoOkonauExpressions,
  stripLocalImageReferences,
  stripRepairEcho,
  useArabicNumeralsForCounters,
} from "../generate/postprocess.js";

describe("simplifyWoOkonauExpressions", () => {
  it("collapses common conjugations of the redundant '〜を行う' pattern", () => {
    expect(simplifyWoOkonauExpressions("設計を行う")).toBe("設計する");
    expect(simplifyWoOkonauExpressions("改善を行った")).toBe("改善した");
    expect(simplifyWoOkonauExpressions("実装を行って")).toBe("実装して");
    expect(simplifyWoOkonauExpressions("確認を行っている")).toBe("確認している");
    expect(simplifyWoOkonauExpressions("更新を行います")).toBe("更新します");
    expect(simplifyWoOkonauExpressions("テストを行わない")).toBe("テストしない");
  });

  it("leaves unrelated text untouched", () => {
    const text = "この記事はダイジェストに基づいて生成されました。";
    expect(simplifyWoOkonauExpressions(text)).toBe(text);
  });

  it("replaces every occurrence in a multi-sentence body", () => {
    const body = "まず設計を行う。次に改善を行った。最後に確認を行います。";
    expect(simplifyWoOkonauExpressions(body)).toBe("まず設計する。次に改善した。最後に確認します。");
  });
});

describe("useArabicNumeralsForCounters", () => {
  it("converts kanji counter digits (一つ〜九つ) to arabic digits", () => {
    expect(useArabicNumeralsForCounters("一つ")).toBe("1つ");
    expect(useArabicNumeralsForCounters("二つ")).toBe("2つ");
    expect(useArabicNumeralsForCounters("九つ")).toBe("9つ");
  });

  it("replaces every occurrence in a sentence", () => {
    const body = "理由は一つではなく、大きく二つある。";
    expect(useArabicNumeralsForCounters(body)).toBe("理由は1つではなく、大きく2つある。");
  });

  it("leaves unrelated kanji numerals untouched", () => {
    const text = "一石二鳥という言葉がある。";
    expect(useArabicNumeralsForCounters(text)).toBe(text);
  });
});

describe("stripRepairEcho", () => {
  it("unwraps a body that echoes the repair-prompt scaffolding", () => {
    const echoed = ["## リンターの指摘", "- [body-length] 本文が短すぎます", "", "## 本文", "## 実際の見出し", "", "本文です。"].join("\n");
    expect(stripRepairEcho(echoed)).toBe(["## 実際の見出し", "", "本文です。"].join("\n"));
  });

  it("leaves a normal body untouched, even one containing 情報源 or 本文 in prose", () => {
    const body = "## 見出し\n\n本文と情報源の話をします。";
    expect(stripRepairEcho(body)).toBe(body);
  });
});

describe("stripLocalImageReferences", () => {
  it("comments out local image references but keeps remote ones", () => {
    const body = "見出し\n\n![alt](./local.png)\n\n![remote](https://example.com/a.png)";
    const result = stripLocalImageReferences(body);
    expect(result).toContain("<!-- 画像参照は自動生成では許可されないため削除されました: ![alt](./local.png) -->");
    expect(result).toContain("![remote](https://example.com/a.png)");
  });
});
