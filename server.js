"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 5630);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = path.join(__dirname, "data");
const GROUP_ID_FILE = path.join(DATA_DIR, "line-group-id.txt");
const MAX_BODY_BYTES = 64 * 1024;
const ALERT_DEDUPE_MS = 10 * 60 * 1000;
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

const recentAlerts = new Map();
const rateBuckets = new Map();

function getLineAccessToken() {
  return (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
}

function getLineChannelSecret() {
  return (process.env.LINE_CHANNEL_SECRET || "").trim();
}

function getSharedAlertKey() {
  return (process.env.NEWS_ALERT_SHARED_SECRET || "").trim();
}

function readSavedGroupId() {
  try {
    return fs.readFileSync(GROUP_ID_FILE, "utf8").trim();
  } catch (error) {
    return "";
  }
}

function getLineGroupId() {
  return (process.env.LINE_GROUP_ID || "").trim() || readSavedGroupId();
}

function isLineConfigured() {
  return Boolean(getLineAccessToken() && getLineGroupId());
}

function getMissingLineConfig() {
  const missing = [];
  if (!getLineAccessToken()) missing.push("LINE_CHANNEL_ACCESS_TOKEN");
  if (!getLineGroupId()) missing.push("LINE_GROUP_ID");
  return missing;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJsonBuffer(buffer) {
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || "https://ai4you.click")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function checkRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = Number(process.env.ALERT_RATE_LIMIT_PER_MINUTE || 20);
  const bucket = rateBuckets.get(ip) || { startedAt: now, count: 0 };

  if (now - bucket.startedAt > windowMs) {
    bucket.startedAt = now;
    bucket.count = 0;
  }

  bucket.count += 1;
  rateBuckets.set(ip, bucket);
  return bucket.count <= maxRequests;
}

function validateAlertKey(req) {
  const expected = getSharedAlertKey();
  if (!expected) return true;
  const actual = String(req.headers["x-news-alert-key"] || "").trim();
  return actual === expected;
}

function cleanText(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function maskIdentifier(value) {
  const text = cleanText(value, 60);
  if (!text) return "";
  if (text.length <= 4) return "***";
  return `${"*".repeat(Math.min(6, text.length - 4))}${text.slice(-4)}`;
}

function formatDisplayDate(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(safeDate);
}

function validateAlertPayload(payload) {
  const errors = [];
  const total = Number(payload.total);

  if (!Number.isFinite(total) || total < 5) {
    errors.push("NEWS total must be 5 or higher for team alert");
  }

  if (!["medium", "high"].includes(payload.riskKey)) {
    errors.push("riskKey must be medium or high");
  }

  if (!Array.isArray(payload.alerts) || payload.alerts.length === 0) {
    errors.push("alerts must contain at least one abnormal value");
  }

  return errors;
}

function buildLineMessage(payload) {
  const total = Number(payload.total);
  const riskLabel = cleanText(payload.riskLabel || payload.riskKey, 80);
  const patientName = cleanText(payload.patientName, 80);
  const hn = maskIdentifier(payload.hn);
  const gestAge = cleanText(payload.gestAge, 40);
  const reporter = payload.reporter && typeof payload.reporter === "object" ? payload.reporter : null;
  const reporterName = reporter && reporter.name ? cleanText(reporter.name, 60) : "";
  const reporterRole = reporter && reporter.role ? cleanText(reporter.role, 40) : "";
  const reporterWard = reporter && reporter.ward ? cleanText(reporter.ward, 60) : "";
  const reporterFull = reporterName ? `${reporterName}${reporterRole ? ` (${reporterRole})` : ""}` : "";

  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const alertLines = alerts.slice(0, 8).map((item) => `- ${cleanText(item, 160)}`);
  const moreText = alerts.length > 8 ? [`- และอีก ${alerts.length - 8} รายการ`] : [];
  const lines = [
    "🚨 Newborn NEWS Alert",
    `ระดับ: ${riskLabel}`,
    `คะแนนรวม: ${Number.isFinite(total) ? total : "-"}`,
    `เวลา: ${formatDisplayDate(payload.assessedAt)}`,
    patientName ? `ผู้ป่วย/เตียง: ${patientName}` : "",
    hn ? `HN: ${hn}` : "",
    gestAge ? `อายุครรภ์: ${gestAge}` : "",
    reporterFull ? `ผู้รายงาน/ประเมิน: ${reporterFull}` : "",
    reporterWard ? `หอผู้ป่วย: ${reporterWard}` : "",
    "ค่าผิดปกติ:",
    ...alertLines,
    ...moreText,
    `แนวทาง: ${cleanText(payload.action, 220) || "ประเมินและแจ้งเจ้าหน้าที่ตามแนวทางหน่วยงาน"}`,
    `ประเมินซ้ำ: ${cleanText(payload.frequency, 80) || "-"}`
  ].filter(Boolean);

  return lines.join("\n").slice(0, 4800);
}

function getAlertFingerprint(payload) {
  const base = {
    assessedAt: payload.assessedAt,
    patientName: cleanText(payload.patientName, 80),
    hn: cleanText(payload.hn, 80),
    total: Number(payload.total),
    riskKey: payload.riskKey,
    alerts: Array.isArray(payload.alerts) ? payload.alerts.slice(0, 8) : []
  };
  return crypto.createHash("sha256").update(JSON.stringify(base)).digest("hex");
}

function isDuplicateAlert(fingerprint) {
  const now = Date.now();
  for (const [key, createdAt] of recentAlerts.entries()) {
    if (now - createdAt > ALERT_DEDUPE_MS) recentAlerts.delete(key);
  }
  if (recentAlerts.has(fingerprint)) return true;
  recentAlerts.set(fingerprint, now);
  return false;
}

async function sendLinePush(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${getLineAccessToken()}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        to: getLineGroupId(),
        messages: [{ type: "text", text }]
      }),
      signal: controller.signal
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`LINE push failed (${response.status}): ${body || response.statusText}`);
    }

    return {
      status: response.status,
      requestId: response.headers.get("x-line-request-id") || ""
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendLineReply(replyToken, text) {
  if (!getLineAccessToken() || !replyToken) return null;

  const response = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getLineAccessToken()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE reply failed (${response.status}): ${body || response.statusText}`);
  }

  return response.headers.get("x-line-request-id") || "";
}

function verifyLineSignature(rawBody, signature) {
  const secret = getLineChannelSecret();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(String(signature));
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function saveGroupId(groupId) {
  if (!groupId || process.env.LINE_GROUP_ID) return false;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(GROUP_ID_FILE, `${groupId}\n`, { mode: 0o600 });
  return true;
}

async function handleAlert(req, res) {
  if (!isAllowedOrigin(req)) {
    sendJson(res, 403, { ok: false, error: "origin_not_allowed" });
    return;
  }

  if (!checkRateLimit(req)) {
    sendJson(res, 429, { ok: false, error: "rate_limited" });
    return;
  }

  if (!validateAlertKey(req)) {
    sendJson(res, 401, { ok: false, error: "invalid_alert_key" });
    return;
  }

  let payload;
  try {
    payload = parseJsonBuffer(await readBody(req));
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "invalid_json" });
    return;
  }

  const errors = validateAlertPayload(payload);
  if (errors.length) {
    sendJson(res, 400, { ok: false, error: "invalid_alert", details: errors });
    return;
  }

  if (!isLineConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: "line_not_configured",
      missing: getMissingLineConfig()
    });
    return;
  }

  const fingerprint = getAlertFingerprint(payload);
  if (isDuplicateAlert(fingerprint)) {
    sendJson(res, 200, { ok: true, sent: false, duplicate: true });
    return;
  }

  try {
    const line = await sendLinePush(buildLineMessage(payload));
    sendJson(res, 200, { ok: true, sent: true, line });
  } catch (error) {
    console.error(error);
    sendJson(res, 502, { ok: false, error: "line_send_failed" });
  }
}

async function handleLineWebhook(req, res) {
  let rawBody;
  try {
    rawBody = await readBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "invalid_body" });
    return;
  }

  if (!verifyLineSignature(rawBody, req.headers["x-line-signature"])) {
    sendJson(res, 401, { ok: false, error: "invalid_line_signature" });
    return;
  }

  let payload;
  try {
    payload = parseJsonBuffer(rawBody);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "invalid_json" });
    return;
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const groupIds = [];

  for (const event of events) {
    const groupId = event?.source?.type === "group" ? event.source.groupId : "";
    if (!groupId) continue;
    groupIds.push(groupId);

    if (saveGroupId(groupId) && event.replyToken) {
      try {
        await sendLineReply(event.replyToken, `Newborn NEWS Alert เชื่อมกลุ่มแล้ว\nGroup ID: ${groupId}\nต่อไปเมื่อ NEWS เป็น Medium/High ระบบจะส่ง Alert เข้ากลุ่มนี้`);
      } catch (error) {
        console.error(error);
      }
    }
  }

  sendJson(res, 200, { ok: true, groupIds });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, { "cache-control": "no-store" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: "newborn-news-alert",
        lineConfigured: isLineConfigured(),
        missing: getMissingLineConfig()
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        ok: true,
        teamAlertAvailable: isLineConfigured(),
        requiresAlertKey: Boolean(getSharedAlertKey())
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/alerts") {
      await handleAlert(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      await handleLineWebhook(req, res);
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  });
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`newborn-news-alert listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  buildLineMessage,
  createServer,
  formatDisplayDate,
  getMissingLineConfig,
  isLineConfigured,
  maskIdentifier,
  validateAlertPayload,
  verifyLineSignature
};
