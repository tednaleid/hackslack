// ABOUTME: Tests for the Transport over a WebSocket, against a local Bun test server.
// ABOUTME: Covers sending, receiving, the server closing the socket, and failing to connect.
import { afterEach, expect, test } from "bun:test";
import { webSocketTransport } from "../../src/cdp/webSocketTransport";
import { eventually } from "../helpers";

let server: ReturnType<typeof Bun.serve> | null = null;

afterEach(() => {
  server?.stop(true);
  server = null;
});

function startEchoServer(): string {
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request, srv) {
      return srv.upgrade(request) ? undefined : new Response("upgrade required", { status: 426 });
    },
    websocket: {
      message(ws, message) {
        if (message === "close-please") ws.close(1000, "bye");
        else ws.send(`echo:${message}`);
      },
    },
  });
  return `ws://127.0.0.1:${server.port}/devtools/browser/test`;
}

test("sends and receives text messages", async () => {
  const transport = await webSocketTransport(startEchoServer());
  const received: string[] = [];
  transport.onMessage((message) => received.push(message));
  transport.send('{"id":1}');
  await eventually(() => received.length === 1);
  expect(received).toEqual(['echo:{"id":1}']);
  transport.close();
});

test("reports close when the server closes the socket", async () => {
  const transport = await webSocketTransport(startEchoServer());
  const reasons: string[] = [];
  transport.onClose((reason) => reasons.push(reason));
  transport.send("close-please");
  await eventually(() => reasons.length === 1);
  expect(reasons[0]).toStartWith("websocket closed");
});

test("rejects when nothing is listening", async () => {
  const url = startEchoServer();
  server!.stop(true);
  server = null;
  await expect(webSocketTransport(url)).rejects.toThrow();
});
