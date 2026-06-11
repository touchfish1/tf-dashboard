/**
 * OpenObserve log shipper.
 *
 * Pino destination stream. Batches JSON log lines and ships them
 * to OpenObserve via HTTP POST every 2s.
 *
 * 内网地址硬编码，可通过环境变量覆盖：
 *   OPENOBSERVE_URL / ORG / STREAM / AUTH
 */

import { Writable } from "stream";

const URL = process.env.OPENOBSERVE_URL || "http://100.125.148.23:5080";
const ORG  = process.env.OPENOBSERVE_ORG  || "default";
const STREAM = process.env.OPENOBSERVE_STREAM || "tf-dashboard";
const AUTH = process.env.OPENOBSERVE_AUTH || "admin@example.com:Cheng1008611.";

let buffer: string[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

export function createOpenObserveStream(): Writable | null {
  const endpoint = `${URL}/api/${ORG}/${STREAM}/_json`;
  const encoded = Buffer.from(AUTH).toString("base64");
  console.error(`[openobserve] shipping to ${endpoint}`);

  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      const line = chunk.toString().trim();
      if (line) buffer.push(line);
      cb();
    },
  });

  timer = setInterval(() => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`,
      },
      body: `[${batch.join(",")}]`,
    }).catch(() => {});
  }, 2000);

  stream.on("close", () => {
    if (timer) clearInterval(timer);
  });

  return stream;
}
