import { describe, it, expect } from "vitest";
import { simplifyWoOkonauExpressions, stripLocalImageReferences } from "../generate/postprocess.js";

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

describe("stripLocalImageReferences", () => {
  it("comments out local image references but keeps remote ones", () => {
    const body = "見出し\n\n![alt](./local.png)\n\n![remote](https://example.com/a.png)";
    const result = stripLocalImageReferences(body);
    expect(result).toContain("<!-- 画像参照は自動生成では許可されないため削除されました: ![alt](./local.png) -->");
    expect(result).toContain("![remote](https://example.com/a.png)");
  });
});
