"use strict";

const fs = require("fs");

const port = process.env.CDP_PORT || "9333";
const screenshotPath = process.env.SCREENSHOT_PATH || "/root/shots/newborn-news/alert-threshold-result.png";

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
    expression: `(async () => {
      if (!window.NewbornNEWS) return { total: "--", risk: "missing app", alerts: [] };
      localStorage.removeItem("newborn-news-records-v1");
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const fillAssessment = (input) => {
        Object.entries(input).forEach(([id, value]) => set(id, value));
      };
      const submitAssessment = async (input) => {
        fillAssessment(input);
        document.querySelector(".primary-button").click();
        await wait(160);
        const calculated = window.NewbornNEWS.calculateNEWS(input);
        return {
          formulaTotal: calculated.total,
          formulaRisk: calculated.risk?.label,
          escalation: window.NewbornNEWS.isEscalationRisk(calculated),
          total: document.getElementById("totalScore").textContent.trim(),
          header: document.getElementById("headerScore").textContent.trim(),
          risk: document.getElementById("riskBadge").textContent.trim(),
          summary: document.getElementById("riskSummary").textContent.trim(),
          alerts: Array.from(document.querySelectorAll("#alertList li")).map((li) => li.textContent.trim()),
          modalVisible: !document.getElementById("alertModal").hidden,
          modalTitle: document.getElementById("alertTitle").textContent.trim(),
          modalDescription: document.getElementById("alertDescription").textContent.trim(),
          modalScore: document.getElementById("modalScore").textContent.trim()
        };
      };
      set("patientName", "Baby Test");
      set("hn", "HN001");
      set("gestAge", "38+2 wk");
      set("assessedAt", "2026-08-28T12:00");

      const lowInput = {
        bt: "37.8",
        hr: "170",
        rr: "70",
        spo2: "98",
        breathing: "normal",
        neuroColor: "pink-alert"
      };
      const low = await submitAssessment(lowInput);

      const mediumInput = {
        bt: "38.5",
        hr: "190",
        rr: "50",
        spo2: "98",
        breathing: "tachypnea",
        neuroColor: "pink-alert"
      };
      const medium = await submitAssessment(mediumInput);
      document.getElementById("ackAlertButton").click();
      await wait(80);

      const highInput = {
        bt: "39.2",
        hr: "205",
        rr: "91",
        spo2: "84",
        breathing: "grunting",
        neuroColor: "pale"
      };
      const high = await submitAssessment(highInput);
      document.getElementById("saveButton").click();
      await wait(80);
      high.historyRows = document.querySelectorAll("#historyBody tr").length;
      high.storedRecords = JSON.parse(localStorage.getItem("newborn-news-records-v1") || "[]").length;

      return {
        hasApp: Boolean(window.NewbornNEWS),
        low,
        medium,
        high
      };
    })()`
  });

  const value = result.result.value;
  if (!value.hasApp) throw new Error("NewbornNEWS app object was not available");
  if (value.low.total !== "3" || !value.low.risk.includes("Low Risk")) {
    throw new Error(`Expected Low Risk total 3, got ${value.low.total} / ${value.low.risk}`);
  }
  if (value.low.escalation || value.low.modalVisible) {
    throw new Error("Low Risk should not open the urgent alert popup");
  }
  if (value.medium.total !== "5" || !value.medium.risk.includes("Medium Risk")) {
    throw new Error(`Expected Medium Risk total 5, got ${value.medium.total} / ${value.medium.risk}`);
  }
  if (!value.medium.escalation || !value.medium.modalVisible || !value.medium.modalTitle.includes("เสี่ยงปานกลาง")) {
    throw new Error("Medium Risk did not open the urgent staff alert popup");
  }
  if (!value.medium.modalDescription.includes("เจ้าหน้าที่เกี่ยวข้องทันที")) {
    throw new Error("Medium Risk popup did not tell staff to alert immediately");
  }
  if (value.high.total !== "18") throw new Error(`Expected total 18, got ${value.high.total}`);
  if (!value.high.risk.includes("High Risk")) throw new Error(`Expected High Risk, got ${value.high.risk}`);
  if (!value.high.alerts.some((text) => text.includes("HR") && text.includes("3 คะแนน"))) {
    throw new Error("Missing HR score 3 alert");
  }
  if (!value.high.escalation || !value.high.modalVisible || value.high.modalScore !== "18" || !value.high.modalTitle.includes("เสี่ยงสูง")) {
    throw new Error("Alert popup did not open with the high-risk result");
  }
  if (!value.high.modalDescription.includes("ทีมฉุกเฉิน") || !value.high.modalDescription.includes("ทันที")) {
    throw new Error("High Risk popup did not include immediate emergency-team wording");
  }
  if (value.high.historyRows < 1 || value.high.storedRecords < 1) {
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
