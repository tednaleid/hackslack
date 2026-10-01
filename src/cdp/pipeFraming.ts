// ABOUTME: Encodes and decodes messages on Chromium's --remote-debugging-pipe.
// ABOUTME: Each message is UTF-8 JSON terminated by a single NUL byte.

export function encodeFrame(message: string): Buffer {
  return Buffer.concat([Buffer.from(message, "utf8"), Buffer.from([0])]);
}

export class FrameDecoder {
  private pending: Buffer = Buffer.alloc(0);

  push(chunk: Uint8Array): string[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    const messages: string[] = [];
    let end: number;
    while ((end = this.pending.indexOf(0)) !== -1) {
      messages.push(this.pending.subarray(0, end).toString("utf8"));
      this.pending = this.pending.subarray(end + 1);
    }
    return messages;
  }
}
