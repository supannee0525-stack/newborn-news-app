"use strict";

const fs = require("fs");

const port = process.env.CDP_PORT || "9333";
const screenshotPath = process.env.SCREENSHOT_PATH || "/root/shots/newborn-news/high-risk-result.png";

async function waitForTab() {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const tabs = await response.json();
        const tab = tabs.find((item) => item.url.includes("/newborn-news/")) || tabs[0];
        if (tab?.webSocketDebuggerUrl) return tab;
      }
    } catch (error) {
      // Browser not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome DevTools tab was not ready");
}

function connectCdp(url) {
  let seq = 0;
  const pending = new Map();
  const ws = new WebSocket(url);

  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const waiter = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message));
    else waiter.resolve(msg.result);
  });

  return {
    opened,
    close: () => ws.close(),
    send(method, params = {}) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

async function main() {
  const tab = await waitForTab();
  const cdp = connectCdp(tab.webSocketDebuggerUrl);
  await cdp.opened;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `new Promise((resolve) => {
      if (document.readyState === "complete") resolve(true);
      else window.addEventListener("load", () => resolve(true), { once: true });
    })`
  });

  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      if (!window.NewbornNEWS) return { total: "--", risk: "missing app", alerts: [] };
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("patientName", "Baby Test");
      set("hn", "HN001");
      set("gestAge", "38+2 wk");
      set("bt", "39.2");
      set("hr", "205");
      set("rr", "91");
      set("spo2", "84");
      set("breathing", "grunting");
      set("neuroColor", "pale");
      document.querySelector(".primary-button").click();
      return new Promise((resolve) => window.setTimeout(() => {
        document.getElementById("saveButton").click();
        const calculated = window.NewbornNEWS.calculateNEWS({
          bt: "39.2",
          hr: "205",
          rr: "91",
          spo2: "84",
          breathing: "grunting",
          neuroColor: "pale"
        });
        resolve({
          hasApp: Boolean(window.NewbornNEWS),
          formulaTotal: calculated.total,
          formulaRisk: calculated.risk?.label,
          total: document.getElementById("totalScore").textContent.trim(),
          header: document.getElementById("headerScore").textContent.trim(),
          risk: document.getElementById("riskBadge").textContent.trim(),
          summary: document.getElementById("riskSummary").textContent.trim(),
          alerts: Array.from(document.querySelectorAll("#alertList li")).map((li) => li.textContent.trim()),
          historyRows: document.querySelectorAll("#historyBody tr").length,
          storedRecords: JSON.parse(localStorage.getItem("newborn-news-records-v1") || "[]").length
        });
      }, 120));
    })()`
  });

  const value = result.result.value;
  if (value.total !== "18") throw new Error(`Expected total 18, got ${value.total}`);
  if (!value.risk.includes("High Risk")) throw new Error(`Expected High Risk, got ${value.risk}`);
  if (!value.alerts.some((text) => text.includes("HR") && text.includes("3 คะแนน"))) {
    throw new Error("Missing HR score 3 alert");
  }
  if (value.historyRows < 1 || value.storedRecords < 1) {
    throw new Error("History record was not saved");
  }

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify(value, null, 2));
  cdp.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
