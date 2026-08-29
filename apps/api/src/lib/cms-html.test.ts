import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml } from "./cms-html";

describe("CMS HTML sanitization", () => {
  it("script, event handler ve javascript URL'lerini kaldırır", () => {
    const result = sanitizeCmsHtml(
      '<h2 onclick="alert(1)">Başlık</h2><script>alert(1)</script><a href="javascript:alert(2)">Git</a><img src="x" onerror="alert(3)">',
    );

    expect(result).toBe('<h2>Başlık</h2><a>Git</a><img src="x" />');
  });

  it("gerekli zengin metni korur ve yeni sekme linkini güvenli hale getirir", () => {
    const result = sanitizeCmsHtml(
      '<p><strong>Metin</strong></p><a href="https://example.com" target="_blank">Kaynak</a><table><tbody><tr><td colspan="2">A</td></tr></tbody></table>',
    );

    expect(result).toContain("<strong>Metin</strong>");
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('<td colspan="2">A</td>');
  });
});
