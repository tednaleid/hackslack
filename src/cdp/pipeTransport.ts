// ABOUTME: Transport over Slack's --remote-debugging-pipe: writes to its fd 3 and reads from its fd 4.
// ABOUTME: Only the process that spawned Slack holds these fds; nothing listens on the network.
import type { Readable, Writable } from "node:stream";
import { encodeFrame, FrameDecoder } from "./pipeFraming";
import type { Transport } from "./transport";

export function pipeTransport(output: Writable, input: Readable): Transport {
  const decoder = new FrameDecoder();
  let onMessage = (_message: string) => {};
  let onClose = (_reason: string) => {};
  let closed = false;
  const finish = (reason: string) => {
    if (closed) return;
    closed = true;
    onClose(reason);
  };

  input.on("data", (chunk: Buffer) => {
    for (const message of decoder.push(chunk)) onMessage(message);
  });
  input.on("end", () => finish("pipe closed by Slack"));
  input.on("error", (error) => finish(`pipe error: ${error.message}`));
  output.on("error", (error) => finish(`pipe error: ${error.message}`));

  return {
    send: (message) => {
      if (!closed) output.write(encodeFrame(message));
    },
    onMessage: (handler) => {
      onMessage = handler;
    },
    onClose: (handler) => {
      onClose = handler;
    },
    close: () => {
      output.end();
    },
  };
}
