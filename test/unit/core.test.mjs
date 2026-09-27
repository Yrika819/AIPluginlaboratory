import { describe, expect, test } from "vitest";
import {
  convertLineEndings,
  dedupeLines,
  decodeUrl,
  encodeUrl,
  formatJson,
  minifyJson,
  normalizeText,
  removeBlankLines,
  slugify,
  sortLines,
  textStats,
  toTitleCase,
  trimLines,
} from "../../web/lib/core.mjs";

describe("text core", () => {
  test("normalizes whitespace and blank lines", () => {
    expect(normalizeText("  hello   world\r\n\r\n\r\n  next\tline  "))
      .toBe("hello world\n\nnext line");
  });

  test("deduplicates with configurable case sensitivity", () => {
    expect(dedupeLines("b\na\nb\nA")).toBe("b\na\nA");
    expect(dedupeLines("b\na\nb\nA", { caseSensitive: false })).toBe("b\na");
  });

  test("sorts naturally", () => {
    expect(sortLines("item10\nitem2\nitem1")).toBe("item1\nitem2\nitem10");
    expect(sortLines("item10\nitem2\nitem1", { descending: true }))
      .toBe("item10\nitem2\nitem1");
  });

  test("formats and minifies JSON", () => {
    const source = '{"b":2,"a":[1,true]}';
    expect(JSON.parse(formatJson(source))).toEqual({ b: 2, a: [1, true] });
    expect(minifyJson(formatJson(source))).toBe(source);
  });

  test("URL encoding round trips Unicode", () => {
    const source = "日本語 & spaces/emoji🙂";
    expect(decodeUrl(encodeUrl(source))).toBe(source);
  });

  test("counts Unicode text and UTF-8 bytes", () => {
    expect(textStats("a b\nあ")).toEqual({
      characters: 5,
      words: 3,
      lines: 2,
      bytes: 7,
    });
  });

  test("converts line endings", () => {
    expect(convertLineEndings("a\r\nb\rc\n", "lf")).toBe("a\nb\nc\n");
    expect(convertLineEndings("a\nb", "crlf")).toBe("a\r\nb");
  });

  test("slugifies Unicode-friendly text", () => {
    expect(slugify("  Café tools — 2026! ")).toBe("cafe-tools-2026");
    expect(slugify("日本語 ツール")).toBe("日本語-ツール");
  });

  test("title case, trim lines and blank removal", () => {
    expect(toTitleCase("hello WORLD")).toBe("Hello World");
    expect(trimLines(" a \n b ")).toBe("a\nb");
    expect(removeBlankLines("a\n \n\nb")).toBe("a\nb");
  });
});
