import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBase64,
  decodeUrl,
  dedupeLines,
  encodeBase64,
  encodeUrl,
  formatJson,
  minifyJson,
  normalizeText,
  sortLines,
  textStats,
} from "../web/lib/core.mjs";

test("normalizeText normalizes whitespace and blank lines", () => {
  assert.equal(
    normalizeText("  hello   world\r\n\r\n\r\n  next\tline  "),
    "hello world\n\nnext line",
  );
});

test("dedupeLines preserves first occurrence", () => {
  assert.equal(dedupeLines("b\na\nb\nA"), "b\na\nA");
  assert.equal(dedupeLines("b\na\nb\nA", { caseSensitive: false }), "b\na");
});

test("sortLines supports numeric-friendly sorting and direction", () => {
  assert.equal(sortLines("item10\nitem2\nitem1"), "item1\nitem2\nitem10");
  assert.equal(
    sortLines("item10\nitem2\nitem1", { descending: true }),
    "item10\nitem2\nitem1",
  );
});

test("JSON formatting round-trips", () => {
  const source = '{"b":2,"a":[1,true]}';
  assert.equal(formatJson(source), '{\n  "b": 2,\n  "a": [\n    1,\n    true\n  ]\n}');
  assert.equal(minifyJson(formatJson(source)), source);
});

test("URL encoding round-trips Unicode", () => {
  const source = "日本語 & spaces/emoji🙂";
  assert.equal(decodeUrl(encodeUrl(source)), source);
});

test("Base64 encoding round-trips UTF-8", () => {
  const source = "PocketBench 日本語 🙂";
  assert.equal(decodeBase64(encodeBase64(source)), source);
});

test("textStats counts characters, words, lines and UTF-8 bytes", () => {
  assert.deepEqual(textStats("a b\nあ"), {
    characters: 5,
    words: 3,
    lines: 2,
    bytes: 7,
  });
});
