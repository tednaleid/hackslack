// ABOUTME: Behaviour every SlackApp implementation must have, run against fakes and real Slack.
// ABOUTME: Inspect mode runs first so the Normal mode launch also proves an existing Slack is replaced.
import { describe, expect, test } from "bun:test";
import type { SlackApp, SlackPage } from "../../src/core/ports";
import { deferred, withTimeout } from "../helpers";

const CONTRACT_CSS = "/* hackslack contract */ .hackslack-contract-probe { color: red }";

export function slackAppContract(name: string, makeApp: () => SlackApp, timeoutMs: number): void {
  describe(`SlackApp contract: ${name}`, () => {
    for (const mode of ["inspect", "normal"] as const) {
      test(
        `${mode}: reports a Slack page, applies CSS in call order, and closes`,
        async () => {
          const app = makeApp();
          const ready = deferred<SlackPage>();
          const exited = deferred<string>();
          const info = await app.launch(mode, {
            pageReady: (page) => ready.resolve(page),
            pageGone: () => {},
            exited: (reason) => exited.resolve(reason),
          });
          expect(info.slackPid).toBeGreaterThan(0);
          expect(info.port === null).toBe(mode === "normal");

          const page = await withTimeout(ready.promise, timeoutMs, "pageReady");
          expect(page.url).toMatch(/^https:\/\/app\.slack\.com\//);

          await Promise.all([app.applyCss(page.id, "/* first */"), app.applyCss(page.id, CONTRACT_CSS)]);
          expect(await app.readAppliedCss(page.id)).toBe(CONTRACT_CSS);

          await app.close();
          if (mode === "normal") {
            expect(typeof (await withTimeout(exited.promise, timeoutMs, "exited"))).toBe("string");
          }
        },
        timeoutMs * 4,
      );
    }
  });
}
