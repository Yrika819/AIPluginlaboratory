import { describe, expect, test } from "vitest";
import {
  delimitedToObjects,
  detectDelimiter,
  jsonToYaml,
  objectsToDelimited,
  parseDelimited,
  queryStringToJson,
  yamlToJson,
} from "../../web/lib/data-tools.mjs";

describe("structured data tools", () => {
  test("detects common delimiters", () => {
    expect(detectDelimiter("a,b\n1,2")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("a;b\n1;2")).toBe(";");
  });

  test("parses quoted commas, newlines and escaped quotes", () => {
    const input = 'name,note\nAlice,"hello, world"\nBob,"line 1\nline 2"\nEve,"a ""quote"""';
    const { rows } = parseDelimited(input, ",");
    expect(rows[1]).toEqual(["Alice", "hello, world"]);
    expect(rows[2]).toEqual(["Bob", "line 1\nline 2"]);
    expect(rows[3]).toEqual(["Eve", 'a "quote"']);
  });

  test("rejects an unclosed quoted field", () => {
    expect(() => parseDelimited('a,b\n1,"oops', ",")).toThrow(/Unclosed/);
  });

  test("creates unique headers and objects", () => {
    const result = delimitedToObjects("name,name,\na,b,c", ",");
    expect(result.data).toEqual([{ name: "a", name_2: "b", column_3: "c" }]);
  });

  test("serializes object arrays with correct escaping", () => {
    const csv = objectsToDelimited([
      { name: "A", note: "x,y" },
      { name: "B", note: 'say "hi"' },
    ]);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"say ""hi"""');
    expect(delimitedToObjects(csv, ",").data).toEqual([
      { name: "A", note: "x,y" },
      { name: "B", note: 'say "hi"' },
    ]);
  });

  test("JSON and YAML round trip", () => {
    const json = '{"name":"PocketBench","items":[1,2],"enabled":true}';
    expect(JSON.parse(yamlToJson(jsonToYaml(json)))).toEqual(JSON.parse(json));
  });

  test("query string conversion preserves duplicate keys", () => {
    expect(JSON.parse(queryStringToJson("https://example.test/?a=1&a=2&b=ok"))).toEqual({
      a: ["1", "2"],
      b: "ok",
    });
  });
});
