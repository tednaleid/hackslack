// ABOUTME: Tests for the Transport over Slack's debugging pipe, using in-process streams.
// ABOUTME: Covers framing in both directions and how closing is reported.
import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { pipeTransport } from "../../src/cdp/pipeTransport";
import { eventually } from "../helpers";

function setup() {
  const toSlack = new PassThrough();
  const fromSlack = new PassThrough();
  const written: Buffer[] = [];
  toSlack.on("data", (chunk: Buffer) => written.push(chunk));
  const transport = pipeTransport(toSlack, fromSlack);
  const received: string[] = [];
  const reasons: string[] = [];
  transport.onMessage((message) => received.push(message));
  transport.onClose((reason) => reasons.push(reason));
  return { toSlack, fromSlack, written, transport, received, reasons };
}

test("writes NUL-terminated frames and decodes incoming ones", async () => {
  const { fromSlack, written, transport, received } = setup();
  transport.send('{"id":1}');
  await eventually(() => written.length > 0);
  expect(Buffer.concat(written).toString("utf8")).toBe('{"id":1}\0');
  fromSlack.write(Buffer.from('{"id":1,"result":{}}\0{"method":"x"}\0'));
  await eventually(() => received.length === 2);
  expect(received).toEqual(['{"id":1,"result":{}}', '{"method":"x"}']);
});

test("reports close once when Slack ends the pipe", async () => {
  const { fromSlack, reasons } = setup();
  fromSlack.end();
  await eventually(() => reasons.length === 1);
  await Bun.sleep(10);
  expect(reasons).toEqual(["pipe closed by Slack"]);
});

test("close() ends the pipe to Slack", () => {
  const { toSlack, transport } = setup();
  transport.close();
  expect(toSlack.writableEnded).toBe(true);
});
