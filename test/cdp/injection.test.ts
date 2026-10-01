// ABOUTME: Tests for the generated CSS injection snippet and the read-back expression.
// ABOUTME: Runs the snippet against a FakeDocument, including CSS that is awkward to embed in JS.
import { expect, test } from "bun:test";
import { buildInjectionSource, READ_APPLIED_CSS, STYLE_ELEMENT_ID } from "../../src/cdp/injection";
import { evaluateIn, FakeDocument } from "../fakes/fakeDocument";

const TRICKY_CSS = [
  `/* "double" and 'single' quotes */`,
  `a::before { content: "\\201C</style><script>alert(1)</script>"; }`,
  `/* na\u00efve \u65e5\u672c line\u2028separator \`backtick\` \${notATemplate} */`,
].join("\n");

test("adds one style element containing the CSS exactly", () => {
  const doc = new FakeDocument();
  evaluateIn(doc, buildInjectionSource(TRICKY_CSS));
  const elements = doc.styleElements();
  expect(elements).toHaveLength(1);
  expect(elements[0]!.tagName).toBe("STYLE");
  expect(elements[0]!.id).toBe(STYLE_ELEMENT_ID);
  expect(elements[0]!.textContent).toBe(TRICKY_CSS);
});

test("running again replaces the CSS in the same element", () => {
  const doc = new FakeDocument();
  evaluateIn(doc, buildInjectionSource(".a { color: red }"));
  evaluateIn(doc, buildInjectionSource(".b { color: blue }"));
  expect(doc.styleElements().map((element) => element.textContent)).toEqual([".b { color: blue }"]);
});

test("applies once the document is parsed when run before it exists", () => {
  const doc = new FakeDocument({ parsed: false });
  evaluateIn(doc, buildInjectionSource(".a {}"));
  expect(doc.styleElements()).toEqual([]);
  doc.finishParsing();
  expect(doc.styleElements().map((element) => element.textContent)).toEqual([".a {}"]);
});

test("READ_APPLIED_CSS returns the applied CSS, or null when none is applied", () => {
  const doc = new FakeDocument();
  expect(evaluateIn(doc, READ_APPLIED_CSS)).toBeNull();
  evaluateIn(doc, buildInjectionSource(TRICKY_CSS));
  expect(evaluateIn(doc, READ_APPLIED_CSS)).toBe(TRICKY_CSS);
});
