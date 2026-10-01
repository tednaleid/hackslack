// ABOUTME: Stylesheets adapter over a directory of .css files, combined in filename order.
// ABOUTME: Watches the directory and reports a change once per burst of saves.
import { watch } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Stylesheets } from "../core/ports";

const isStylesheet = (name: string) => name.endsWith(".css") && !name.startsWith(".");

export class FsStylesheets implements Stylesheets {
  constructor(
    private readonly dir: string,
    private readonly debounceMs = 100,
  ) {}

  async load(): Promise<string> {
    const names = (await readdir(this.dir)).filter(isStylesheet).sort();
    const parts = await Promise.all(
      names.map(async (name) => `/* ${name} */\n${await readFile(join(this.dir, name), "utf8")}`),
    );
    return parts.join("\n");
  }

  watch(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watcher = watch(this.dir, (_event, name) => {
      if (name && !isStylesheet(String(name))) return;
      clearTimeout(timer);
      timer = setTimeout(onChange, this.debounceMs);
    });
    return () => {
      clearTimeout(timer);
      watcher.close();
    };
  }
}
