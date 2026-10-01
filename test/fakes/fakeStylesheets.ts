// ABOUTME: In-memory Stylesheets for testing the core without touching the filesystem.
// ABOUTME: change() updates the CSS and notifies watchers; loadError makes load() fail.
import type { Stylesheets } from "../../src/core/ports";

export class FakeStylesheets implements Stylesheets {
  loadError: Error | null = null;
  watcherCount = 0;
  private readonly listeners = new Set<() => void>();

  constructor(public css = "") {}

  async load(): Promise<string> {
    if (this.loadError) throw this.loadError;
    return this.css;
  }

  watch(onChange: () => void): () => void {
    this.listeners.add(onChange);
    this.watcherCount++;
    return () => {
      if (this.listeners.delete(onChange)) this.watcherCount--;
    };
  }

  change(css: string): void {
    this.css = css;
    for (const listener of this.listeners) listener();
  }
}
