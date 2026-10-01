// ABOUTME: Builds the only JavaScript the Launcher runs in Slack: a snippet that sets one style element.
// ABOUTME: The CSS is embedded with JSON.stringify; READ_APPLIED_CSS is a constant read-back expression.

export const STYLE_ELEMENT_ID = "hackslack-styles";

export function buildInjectionSource(css: string): string {
  return `(() => {
  const ID = ${JSON.stringify(STYLE_ELEMENT_ID)};
  const CSS = ${JSON.stringify(css)};
  const apply = () => {
    const root = document.head || document.documentElement;
    if (!root) return;
    let element = document.getElementById(ID);
    if (!element) {
      element = document.createElement("style");
      element.id = ID;
    }
    element.textContent = CSS;
    if (!element.isConnected) root.appendChild(element);
  };
  apply();
  document.addEventListener("DOMContentLoaded", apply);
})()`;
}

export const READ_APPLIED_CSS = `document.getElementById(${JSON.stringify(STYLE_ELEMENT_ID)})?.textContent ?? null`;
