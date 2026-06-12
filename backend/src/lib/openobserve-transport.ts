/**
 * OpenObserve log shipper.
 *
 * Pino destination stream. Batches JSON log lines and ships them
 * to OpenObserve via HTTP POST every 2s.
 *
 * Only enabled when ALL required env vars are set:
 *   OPENOBSERVE_URL
 *   OPENOBSERVE_USER
 *   OPENOBSERVE_PASSWORD
 *   OPENOBSERVE_ORG
 *   OPENOBSERVE_STREAM
 */

import { Writable } from "stream";
import { logger } from "./logger";

const URL = process.env.OPENOBSERVE_URL;
const ORG  = process.env.OPENOBSERVE_ORG;
const STREAM = process.env.OPENOBSERVE_STREAM;
const USER = process.env.OPENOBSERVE_USER;
const PASS = process.env.OPENOBSERVE_PASSWORD;

let buffer: string[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

export function createOpenObserveStream(): Writable | null {
  if (!URL || !ORG || !STREAM || !USER || !PASS) {
    logger.info({ event: 'openobserve_disabled' }, 'OpenObserve 未配置（需要 OPENOBSERVE_URL/USER/PASSWORD/ORG/STREAM），日志仅输出到 stdout');
    return null;
  }

  const endpoint = `${URL}/api/${ORG}/${STREAM}/_json`;
  const auth = `${USER}:${PASS}`;
  const encoded = Buffer.from(auth).toString("base64");
  logger.info({ endpoint, event: 'openobserve_enabled' }, `OpenObserve 日志已启用: ${endpoint}`);

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
    }).catch((err) => {
      logger.warn({ err, event: 'openobserve_push_failed' }, 'OpenObserve 日志推送失败');
    });
  }, 2000);

  stream.on("close", () => {
    if (timer) clearInterval(timer);
  });

  return stream;
}
