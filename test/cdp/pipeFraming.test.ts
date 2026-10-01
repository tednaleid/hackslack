// ABOUTME: Tests for the NUL-terminated frame codec used on Slack's debugging pipe.
// ABOUTME: Covers chunk boundaries, several frames per chunk and split UTF-8 characters.
import { describe, expect, test } from "bun:test";
import { encodeFrame, FrameDecoder } from "../../src/cdp/pipeFraming";

describe("FrameDecoder", () => {
  test("decodes one complete message", () => {
    expect(new FrameDecoder().push(encodeFrame('{"id":1}'))).toEqual(['{"id":1}']);
  });

  test("decodes several messages in one chunk", () => {
    const chunk = Buffer.concat([encodeFrame("a"), encodeFrame("b"), encodeFrame("c")]);
    expect(new FrameDecoder().push(chunk)).toEqual(["a", "b", "c"]);
  });

  test("buffers a message split across chunks", () => {
    const frame = encodeFrame('{"method":"Target.targetCreated"}');
    const decoder = new FrameDecoder();
    expect(decoder.push(frame.subarray(0, 10))).toEqual([]);
    expect(decoder.push(frame.subarray(10))).toEqual(['{"method":"Target.targetCreated"}']);
  });

  test("keeps a multi-byte character intact when split between chunks", () => {
    const frame = encodeFrame('"é"'); // bytes 22 c3 a9 22 00
    const decoder = new FrameDecoder();
    expect(decoder.push(frame.subarray(0, 2))).toEqual([]);
    expect(decoder.push(frame.subarray(2))).toEqual(['"é"']);
  });

  test("holds a trailing partial message until its terminator arrives", () => {
    const decoder = new FrameDecoder();
    expect(decoder.push(Buffer.concat([encodeFrame("first"), Buffer.from("seco")]))).toEqual(["first"]);
    expect(decoder.push(Buffer.from("nd\0"))).toEqual(["second"]);
  });
});

describe("encodeFrame", () => {
  test("appends a single NUL byte to the UTF-8 bytes", () => {
    expect([...encodeFrame("hé")]).toEqual([0x68, 0xc3, 0xa9, 0x00]);
  });
});
