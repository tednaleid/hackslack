// ABOUTME: Minimal stand-in for a browser document, enough to run the CSS injection snippet.
// ABOUTME: Used by the injection tests and by FakeChromium to evaluate expressions in a page.

export class FakeElement {
  id = "";
  textContent = "";
  parent: FakeContainer | null = null;

  constructor(readonly tagName: string) {}

  get isConnected(): boolean {
    return this.parent !== null;
  }
}

export class FakeContainer {
  readonly children: FakeElement[] = [];

  appendChild(element: FakeElement): FakeElement {
    element.parent = this;
    this.children.push(element);
    return element;
  }
}

export class FakeDocument {
  head: FakeContainer | null;
  documentElement: FakeContainer | null;
  private readonly listeners = new Map<string, (() => void)[]>();

  constructor(options: { parsed?: boolean } = {}) {
    const parsed = options.parsed ?? true;
    this.documentElement = parsed ? new FakeContainer() : null;
    this.head = parsed ? new FakeContainer() : null;
  }

  getElementById(id: string): FakeElement | null {
    return this.styleElements().find((element) => element.id === id) ?? null;
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName.toUpperCase());
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  finishParsing(): void {
    this.documentElement ??= new FakeContainer();
    this.head ??= new FakeContainer();
    for (const listener of this.listeners.get("DOMContentLoaded") ?? []) listener();
  }

  styleElements(): FakeElement[] {
    return [...(this.head?.children ?? []), ...(this.documentElement?.children ?? [])];
  }
}

export function evaluateIn(doc: FakeDocument, expression: string): unknown {
  return new Function("document", `return ${expression}`)(doc);
}
