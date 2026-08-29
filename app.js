(function (global) {
  "use strict";

  const STORAGE_KEY = "newborn-news-records-v1";
  const ALERT_KEY_STORAGE_KEY = "newborn-news-alert-key";
  const NOTIF_SOUND_STORAGE_KEY = "newborn-news-sound-enabled";

  const RISK_LEVELS = [
    {
      key: "normal",
      min: 0,
      max: 2,
      label: "ปกติ (Normal)",
      action: "ดูแลตามปกติ ประเมินตามแผนการรักษา",
      frequency: "ทุก 4-8 ชั่วโมง"
    },
    {
      key: "low",
      min: 3,
      max: 4,
      label: "เฝ้าระวัง (Low Risk)",
      action: "แจ้งพยาบาลผู้รับผิดชอบ บันทึกและติดตามอาการ",
      frequency: "ทุก 2-4 ชั่วโมง"
    },
    {
      key: "medium",
      min: 5,
      max: 6,
      label: "ความเสี่ยงปานกลาง (Medium Risk)",
      action: "แจ้งแพทย์ทันที เพิ่มการติดตามอาการ พิจารณาย้าย NICU",
      frequency: "ทุก 1-2 ชั่วโมง"
    },
    {
      key: "high",
      min: 7,
      max: Infinity,
      label: "ความเสี่ยงสูง (High Risk)",
      action: "แจ้งแพทย์/ทีมฉุกเฉินทันที เตรียม Resuscitation พิจารณาย้าย NICU",
      frequency: "ต่อเนื่อง / Continuous Monitoring"
    }
  ];

  const NUMERIC_FIELDS = {
    bt: {
      label: "BT",
      unit: "°C",
      min: 25,
      max: 45,
      decimals: 1,
      rules: [
        { score: 3, text: "BT < 35.0", test: (value) => value < 35 },
        { score: 2, text: "BT 35.0-35.9", test: (value) => value >= 35 && value < 36 },
        { score: 1, text: "BT 36.0-36.4", test: (value) => value >= 36 && value < 36.5 },
        { score: 0, text: "BT 36.5-37.5", test: (value) => value >= 36.5 && value <= 37.5 },
        { score: 1, text: "BT 37.6-38.0", test: (value) => value > 37.5 && value <= 38 },
        { score: 2, text: "BT 38.1-38.9", test: (value) => value > 38 && value < 39 },
        { score: 3, text: "BT ≥ 39.0", test: (value) => value >= 39 }
      ]
    },
    hr: {
      label: "HR",
      unit: "/min",
      min: 0,
      max: 320,
      decimals: 0,
      rules: [
        { score: 3, text: "HR < 80", test: (value) => value < 80 },
        { score: 2, text: "HR 80-89", test: (value) => value >= 80 && value <= 89 },
        { score: 1, text: "HR 90-99", test: (value) => value >= 90 && value <= 99 },
        { score: 0, text: "HR 100-160", test: (value) => value >= 100 && value <= 160 },
        { score: 1, text: "HR 161-180", test: (value) => value >= 161 && value <= 180 },
        { score: 2, text: "HR 181-200", test: (value) => value >= 181 && value <= 200 },
        { score: 3, text: "HR > 200", test: (value) => value > 200 }
      ]
    },
    rr: {
      label: "RR",
      unit: "/min",
      min: 0,
      max: 180,
      decimals: 0,
      rules: [
        { score: 3, text: "RR < 20", test: (value) => value < 20 },
        { score: 2, text: "RR 20-29", test: (value) => value >= 20 && value <= 29 },
        { score: 1, text: "RR 30-39", test: (value) => value >= 30 && value <= 39 },
        { score: 0, text: "RR 40-60", test: (value) => value >= 40 && value <= 60 },
        { score: 1, text: "RR 61-80", test: (value) => value >= 61 && value <= 80 },
        { score: 2, text: "RR 81-90", test: (value) => value >= 81 && value <= 90 },
        { score: 3, text: "RR > 90", test: (value) => value > 90 }
      ]
    },
    spo2: {
      label: "SpO2",
      unit: "%",
      min: 0,
      max: 100,
      decimals: 0,
      rules: [
        { score: 3, text: "SpO2 < 85", test: (value) => value < 85 },
        { score: 2, text: "SpO2 85-89", test: (value) => value >= 85 && value <= 89 },
        { score: 1, text: "SpO2 90-94", test: (value) => value >= 90 && value <= 94 },
        { score: 0, text: "SpO2 95-100", test: (value) => value >= 95 && value <= 100 }
      ]
    }
  };

  const SELECT_FIELDS = {
    breathing: {
      label: "ลักษณะการหายใจ",
      options: {
        normal: { score: 0, text: "Normal" },
        tachypnea: { score: 1, text: "Tachypnea" },
        "mild-retraction-flaring": { score: 1, text: "Mild Retraction / Flaring" },
        "moderate-retraction": { score: 2, text: "Moderate Retraction" },
        "severe-retraction": { score: 2, text: "Severe Retraction" },
        grunting: { score: 3, text: "Grunting" },
        "apnea-gasping": { score: 3, text: "Apnea / Gasping" }
      }
    },
    neuroColor: {
      label: "สีผิว / ความรู้สึกตัว",
      options: {
        "pink-alert": { score: 0, text: "ชมพู / ตื่นตัว" },
        irritable: { score: 1, text: "หงุดหงิด (Irritable)" },
        "mottled-drowsy-unwell": { score: 1, text: "Mottled / ซึม / ดูไม่ดี" },
        restless: { score: 2, text: "กระสับกระส่าย" },
        cyanosis: { score: 2, text: "เขียว (Cyanosis)" },
        pale: { score: 3, text: "ซีด (Pale)" },
        "seizure-unresponsive": { score: 3, text: "ชัก / ไม่ตอบสนอง" }
      }
    }
  };

  function getRisk(total) {
    return RISK_LEVELS.find((level) => total >= level.min && total <= level.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
  }

  function formatNumericValue(key, value) {
    const field = NUMERIC_FIELDS[key];
    return `${Number(value).toFixed(field.decimals)} ${field.unit}`;
  }

  function scoreNumeric(key, rawValue) {
    const field = NUMERIC_FIELDS[key];
    const value = Number(rawValue);

    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      return {
        key,
        label: field.label,
        score: null,
        value: "",
        rule: "ยังไม่ได้กรอก",
        status: "missing",
        message: `${field.label}: กรุณากรอกค่า`
      };
    }

    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      return {
        key,
        label: field.label,
        score: null,
        value: rawValue,
        rule: "ค่านอกช่วงที่ระบบรับได้",
        status: "invalid",
        message: `${field.label}: ตรวจค่าที่กรอก (${field.min}-${field.max}${field.unit})`
      };
    }

    const rule = field.rules.find((item) => item.test(value));
    if (!rule) {
      return {
        key,
        label: field.label,
        score: null,
        value,
        rule: "ไม่พบช่วงคะแนน",
        status: "invalid",
        message: `${field.label}: ไม่พบช่วงคะแนนในตาราง`
      };
    }

    return {
      key,
      label: field.label,
      score: rule.score,
      value,
      displayValue: formatNumericValue(key, value),
      rule: rule.text,
      status: "ok",
      message: `${field.label} ${formatNumericValue(key, value)}: ${rule.text} = ${rule.score} คะแนน`
    };
  }

  function scoreSelect(key, rawValue) {
    const field = SELECT_FIELDS[key];
    const option = field.options[rawValue];

    if (!rawValue) {
      return {
        key,
        label: field.label,
        score: null,
        value: "",
        rule: "ยังไม่ได้เลือก",
        status: "missing",
        message: `${field.label}: กรุณาเลือกอาการ`
      };
    }

    if (!option) {
      return {
        key,
        label: field.label,
        score: null,
        value: rawValue,
        rule: "ตัวเลือกไม่ถูกต้อง",
        status: "invalid",
        message: `${field.label}: ตัวเลือกไม่ถูกต้อง`
      };
    }

    return {
      key,
      label: field.label,
      score: option.score,
      value: rawValue,
      displayValue: option.text,
      rule: option.text,
      status: "ok",
      message: `${field.label}: ${option.text} = ${option.score} คะแนน`
    };
  }

  function calculateNEWS(input) {
    const details = [
      scoreNumeric("bt", input.bt),
      scoreNumeric("hr", input.hr),
      scoreNumeric("rr", input.rr),
      scoreNumeric("spo2", input.spo2),
      scoreSelect("breathing", input.breathing),
      scoreSelect("neuroColor", input.neuroColor)
    ];

    const problems = details.filter((item) => item.status !== "ok");
    const complete = problems.length === 0;
    const total = complete ? details.reduce((sum, item) => sum + item.score, 0) : null;
    const risk = complete ? getRisk(total) : null;
    const alerts = complete ? details.filter((item) => item.score > 0) : [];
    const criticalAlerts = complete ? details.filter((item) => item.score === 3) : [];

    return {
      complete,
      total,
      risk,
      details,
      alerts,
      criticalAlerts,
      problems
    };
  }

  function isEscalationRisk(result) {
    return Boolean(result?.complete && (result.risk?.key === "medium" || result.risk?.key === "high"));
  }

  function getEscalationCopy(result) {
    const criticalText = result.criticalAlerts.length
      ? ` และมีค่า Score 3 จำนวน ${result.criticalAlerts.length} รายการ`
      : "";

    if (result.risk.key === "high") {
      return {
        title: "เสี่ยงสูง: แจ้งทีมทันที",
        description: `คะแนนรวม ${result.total} คะแนน เข้าเกณฑ์เสี่ยงสูง ต้องแจ้งแพทย์/ทีมฉุกเฉินและเจ้าหน้าที่เกี่ยวข้องทันที${criticalText}`
      };
    }

    if (result.risk.key === "medium") {
      return {
        title: "เสี่ยงปานกลาง: แจ้งเจ้าหน้าที่ทันที",
        description: `คะแนนรวม ${result.total} คะแนน เข้าเกณฑ์เสี่ยงปานกลาง ต้องแจ้งแพทย์และเจ้าหน้าที่เกี่ยวข้องทันที${criticalText}`
      };
    }

    return {
      title: "พบค่าผิดปกติ",
      description: `คะแนนรวม ${result.total} คะแนน: ${result.risk.label}`
    };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toDatetimeLocal(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDisplayDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }

  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playAlertSound(riskKey, soundEnabled) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      if (riskKey === "high") {
        const tones = [880, 1046.5, 880];
        tones.forEach((freq, idx) => {
          const offset = idx * 0.16;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(0.3, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.13);
        });
      } else if (riskKey === "medium") {
        const tones = [659.25, 880];
        tones.forEach((freq, idx) => {
          const offset = idx * 0.18;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(0.2, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.16);
        });
      }
    } catch (error) {
      console.warn("Audio alert error:", error);
    }
  }

  function triggerVibration(riskKey) {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    try {
      if (riskKey === "high") {
        navigator.vibrate([250, 100, 250, 100, 350]);
      } else if (riskKey === "medium") {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (err) {
      // Ignore vibration error
    }
  }

  function sendSystemNotification({ title, body, tag, requireInteraction = false, onClick = null }) {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return null;
    }
    try {
      const notif = new Notification(title, {
        body,
        tag: tag || "newborn-news-alert",
        requireInteraction: Boolean(requireInteraction)
      });
      notif.onclick = function () {
        if (typeof window.focus === "function") window.focus();
        if (typeof onClick === "function") onClick();
        notif.close();
      };
      return notif;
    } catch (error) {
      console.warn("Could not dispatch system notification:", error);
      return null;
    }
  }

  function initializeApp() {
    const form = document.getElementById("newsForm");
    const fields = {
      patientName: document.getElementById("patientName"),
      hn: document.getElementById("hn"),
      gestAge: document.getElementById("gestAge"),
      assessedAt: document.getElementById("assessedAt"),
      bt: document.getElementById("bt"),
      hr: document.getElementById("hr"),
      rr: document.getElementById("rr"),
      spo2: document.getElementById("spo2"),
      breathing: document.getElementById("breathing"),
      neuroColor: document.getElementById("neuroColor")
    };

    const ui = {
      headerScore: document.getElementById("headerScore"),
      headerRisk: document.getElementById("headerRisk"),
      riskBadge: document.getElementById("riskBadge"),
      totalScore: document.getElementById("totalScore"),
      riskSummary: document.getElementById("riskSummary"),
      recommendation: document.getElementById("recommendation"),
      alertList: document.getElementById("alertList"),
      teamAlertStatus: document.getElementById("teamAlertStatus"),
      breakdownList: document.getElementById("breakdownList"),
      historyBody: document.getElementById("historyBody"),
      saveButton: document.getElementById("saveButton"),
      printButton: document.getElementById("printButton"),
      exportButton: document.getElementById("exportButton"),
      clearHistoryButton: document.getElementById("clearHistoryButton"),
      fillNowButton: document.getElementById("fillNowButton"),
      mobileScore: document.getElementById("mobileScore"),
      mobileRisk: document.getElementById("mobileRisk"),
      mobileCalculateButton: document.getElementById("mobileCalculateButton"),
      toast: document.getElementById("toast"),
      alertBanner: document.getElementById("alertBanner"),
      bannerTime: document.getElementById("bannerTime"),
      bannerTitle: document.getElementById("bannerTitle"),
      bannerMessage: document.getElementById("bannerMessage"),
      alertModal: document.getElementById("alertModal"),
      closeAlertButton: document.getElementById("closeAlertButton"),
      ackAlertButton: document.getElementById("ackAlertButton"),
      modalSaveButton: document.getElementById("modalSaveButton"),
      modalPrintButton: document.getElementById("modalPrintButton"),
      modalScore: document.getElementById("modalScore"),
      modalRisk: document.getElementById("modalRisk"),
      alertTitle: document.getElementById("alertTitle"),
      alertDescription: document.getElementById("alertDescription"),
      modalAction: document.getElementById("modalAction"),
      modalFrequency: document.getElementById("modalFrequency"),
      modalAlertList: document.getElementById("modalAlertList"),
      toggleNotifPermissionBtn: document.getElementById("toggleNotifPermissionBtn"),
      toggleSoundBtn: document.getElementById("toggleSoundBtn"),
      testAlertBtn: document.getElementById("testAlertBtn"),
      notificationStatusText: document.getElementById("notificationStatusText"),
      notificationStatusSub: document.getElementById("notificationStatusSub")
    };

    let soundEnabled = localStorage.getItem(NOTIF_SOUND_STORAGE_KEY) !== "false";
    let currentResult = null;
    let toastTimer = null;
    let teamAlertConfig = {
      checked: false,
      teamAlertAvailable: false,
      requiresAlertKey: false
    };

    fields.assessedAt.value = toDatetimeLocal(new Date());
    renderHistory();
    loadTeamAlertConfig();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      currentResult = runCalculation(true);
    });

    form.addEventListener("reset", () => {
      window.setTimeout(() => {
        fields.assessedAt.value = toDatetimeLocal(new Date());
        currentResult = null;
        renderEmptyResult();
        updateButtons();
        closeAlertBanner();
        closeAlertPopup();
        Object.keys(NUMERIC_FIELDS).forEach((key) => updateScorePill(key, null));
        Object.keys(SELECT_FIELDS).forEach((key) => updateScorePill(key, null));
      }, 0);
    });

    Object.values(fields).forEach((field) => {
      field.addEventListener("input", () => {
        currentResult = runCalculation(false);
      });
      field.addEventListener("change", () => {
        currentResult = runCalculation(false);
      });
    });

    ui.fillNowButton.addEventListener("click", () => {
      fields.assessedAt.value = toDatetimeLocal(new Date());
      showToast("ใส่เวลาปัจจุบันแล้ว");
    });

    ui.mobileCalculateButton.addEventListener("click", () => {
      if (form.requestSubmit) {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    });

    ui.saveButton.addEventListener("click", () => {
      if (!currentResult || !currentResult.complete) {
        showToast("กรอกข้อมูลให้ครบก่อนบันทึก");
        return;
      }
      saveCurrentRecord();
    });

    ui.printButton.addEventListener("click", () => {
      if (currentResult && currentResult.complete) window.print();
    });

    ui.exportButton.addEventListener("click", exportCsv);

    ui.clearHistoryButton.addEventListener("click", () => {
      const records = loadRecords();
      if (!records.length) return;
      const confirmed = window.confirm("ต้องการลบประวัติการติดตามทั้งหมดใน browser นี้ใช่ไหม");
      if (!confirmed) return;
      saveRecords([]);
      renderHistory();
      showToast("ลบประวัติแล้ว");
    });

    ui.closeAlertButton.addEventListener("click", closeAlertPopup);
    ui.ackAlertButton.addEventListener("click", closeAlertPopup);
    ui.alertBanner.addEventListener("click", () => {
      if (currentResult && isEscalationRisk(currentResult)) {
        openAlertPopup(currentResult);
      }
    });
    ui.alertModal.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-alert")) closeAlertPopup();
    });
    ui.modalSaveButton.addEventListener("click", () => {
      if (!currentResult || !currentResult.complete) return;
      saveCurrentRecord();
      closeAlertPopup();
    });
    ui.modalPrintButton.addEventListener("click", () => {
      if (!currentResult || !currentResult.complete) return;
      closeAlertPopup();
      window.setTimeout(() => window.print(), 0);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !ui.alertModal.hidden) closeAlertPopup();
    });

    function updateNotificationUI() {
      if (!ui.toggleNotifPermissionBtn || !ui.notificationStatusSub) return;

      if (typeof window === "undefined" || !("Notification" in window)) {
        ui.toggleNotifPermissionBtn.textContent = "🔔 ไม่รองรับ OS Notification";
        ui.toggleNotifPermissionBtn.className = "notif-btn muted-state";
        ui.toggleNotifPermissionBtn.disabled = true;
        ui.notificationStatusSub.textContent = "บราวเซอร์นี้ไม่รองรับ Web Notification API (แต่ยังใช้ Alert Banner และเสียงเตือนได้)";
        return;
      }

      const permission = Notification.permission;
      if (permission === "granted") {
        ui.toggleNotifPermissionBtn.textContent = "✅ เปิดแจ้งเตือนหน้าจอแล้ว";
        ui.toggleNotifPermissionBtn.className = "notif-btn active";
        ui.notificationStatusSub.textContent = "ระบบจะเด้ง Notification บนหน้าจอของเครื่องและเปิด Banner เมื่อพบความเสี่ยง Medium / High";
      } else if (permission === "denied") {
        ui.toggleNotifPermissionBtn.textContent = "❌ บราวเซอร์ปิดกั้นแจ้งเตือน";
        ui.toggleNotifPermissionBtn.className = "notif-btn muted-state";
        ui.notificationStatusSub.textContent = "โปรดอนุญาตการแจ้งเตือนในการตั้งค่าบราวเซอร์เพื่อรับการแจ้งเตือนบนหน้าจอ";
      } else {
        ui.toggleNotifPermissionBtn.textContent = "🔔 เปิดแจ้งเตือนหน้าจอ";
        ui.toggleNotifPermissionBtn.className = "notif-btn";
        ui.notificationStatusSub.textContent = "คลิกเพื่ออนุญาตให้ระบบเด้งแจ้งเตือนบนหน้าจอ (OS / Browser Notification)";
      }
    }

    function updateSoundUI() {
      if (!ui.toggleSoundBtn) return;
      if (soundEnabled) {
        ui.toggleSoundBtn.textContent = "🔊 เปิดเสียงเตือน";
        ui.toggleSoundBtn.className = "notif-btn active";
        ui.toggleSoundBtn.setAttribute("aria-pressed", "true");
      } else {
        ui.toggleSoundBtn.textContent = "🔇 ปิดเสียงเตือน";
        ui.toggleSoundBtn.className = "notif-btn muted-state";
        ui.toggleSoundBtn.setAttribute("aria-pressed", "false");
      }
    }

    async function handleRequestPermission() {
      if (typeof window === "undefined" || !("Notification" in window)) {
        showToast("บราวเซอร์นี้ไม่รองรับ System Notification");
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        updateNotificationUI();
        if (permission === "granted") {
          showToast("เปิดการแจ้งเตือนหน้าจอเรียบร้อยแล้ว");
          sendSystemNotification({
            title: "Newborn NEWS: ระบบแจ้งเตือนพร้อมใช้งาน",
            body: "จะมีการแจ้งเตือนบนหน้าจอเมื่อพบผู้ป่วยมีความเสี่ยง Medium หรือ High Risk",
            tag: "newborn-news-setup-ok"
          });
        } else if (permission === "denied") {
          showToast("บราวเซอร์ถูกตั้งค่าปิดกั้นการแจ้งเตือน");
        }
      } catch (err) {
        console.warn("Permission request error:", err);
      }
    }

    if (ui.toggleNotifPermissionBtn) {
      ui.toggleNotifPermissionBtn.addEventListener("click", handleRequestPermission);
    }

    if (ui.toggleSoundBtn) {
      ui.toggleSoundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem(NOTIF_SOUND_STORAGE_KEY, String(soundEnabled));
        updateSoundUI();
        showToast(soundEnabled ? "เปิดเสียงสัญญาณเตือนแล้ว" : "ปิดเสียงสัญญาณเตือนแล้ว");
        if (soundEnabled) {
          playAlertSound("medium", true);
        }
      });
    }

    if (ui.testAlertBtn) {
      ui.testAlertBtn.addEventListener("click", () => {
        getAudioContext();
        const mockTestResult = {
          complete: true,
          total: 8,
          risk: RISK_LEVELS[3],
          alerts: [
            { score: 3, message: "HR > 200: 3 คะแนน" },
            { score: 3, message: "SpO2 < 85: 3 คะแนน" },
            { score: 2, message: "BT 38.1-38.9: 2 คะแนน" }
          ],
          criticalAlerts: [
            { score: 3, message: "HR > 200: 3 คะแนน" },
            { score: 3, message: "SpO2 < 85: 3 คะแนน" }
          ],
          details: []
        };
        showAlertBanner(mockTestResult);
        showToast("ทดสอบแจ้งเตือนหน้าจอ (Banner + Sound + System Notification)");
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          handleRequestPermission();
        }
      });
    }

    updateNotificationUI();
    updateSoundUI();
    renderEmptyResult();

    function getInput() {
      return {
        patientName: fields.patientName.value.trim(),
        hn: fields.hn.value.trim(),
        gestAge: fields.gestAge.value.trim(),
        assessedAt: fields.assessedAt.value,
        bt: fields.bt.value,
        hr: fields.hr.value,
        rr: fields.rr.value,
        spo2: fields.spo2.value,
        breathing: fields.breathing.value,
        neuroColor: fields.neuroColor.value
      };
    }

    function runCalculation(showProblemToast) {
      const result = calculateNEWS(getInput());
      renderResult(result);
      updateButtons();

      if (!showProblemToast && !ui.alertModal.hidden) {
        closeAlertPopup();
      }

      if (!showProblemToast && !ui.alertBanner.hidden) {
        closeAlertBanner();
      }

      if (showProblemToast && !result.complete) {
        closeAlertBanner();
        closeAlertPopup();
        showToast(result.problems[0]?.message || "กรอกข้อมูลให้ครบก่อนคำนวณ");
      }

      if (showProblemToast && result.complete) {
        if (isEscalationRisk(result)) {
          showAlertBanner(result);
          sendTeamAlert(result);
        } else if (result.alerts.length) {
          closeAlertBanner();
          closeAlertPopup();
          showToast("แสดงผลแล้ว: ยังไม่เข้าเกณฑ์ Alert เร่งด่วน");
        } else {
          closeAlertBanner();
          closeAlertPopup();
          showToast("ไม่พบค่าผิดปกติตามตารางนี้");
        }
      }

      return result;
    }

    function renderResult(result) {
      result.details.forEach((detail) => updateScorePill(detail.key, detail));

      if (!result.complete) {
        const missingCount = result.problems.filter((item) => item.status === "missing").length;
        ui.headerScore.textContent = "--";
        ui.headerRisk.textContent = missingCount ? `ยังขาด ${missingCount} ช่อง` : "ตรวจข้อมูล";
        ui.mobileScore.textContent = "--";
        ui.mobileRisk.textContent = missingCount ? `ยังขาด ${missingCount} ช่อง` : "ตรวจข้อมูล";
        ui.totalScore.textContent = "--";
        ui.riskSummary.textContent = result.problems.map((item) => item.message).join(" / ");
        ui.riskBadge.textContent = missingCount ? "ข้อมูลยังไม่ครบ" : "ข้อมูลไม่ถูกต้อง";
        ui.riskBadge.className = "risk-badge waiting";
        ui.recommendation.innerHTML = `
          <h3>แนวทางตอบสนอง</h3>
          <p>กรอกข้อมูลให้ครบก่อน ระบบจึงจะรวมคะแนนและแปลผลได้</p>
          <span>ความถี่ประเมินซ้ำ: --</span>
        `;
        ui.alertList.innerHTML = `<li class="muted">ยังไม่มีผลแจ้งเตือนจนกว่าจะกรอกข้อมูลครบ</li>`;
        renderBreakdown(result.details);
        return;
      }

      const risk = result.risk;
      ui.headerScore.textContent = result.total;
      ui.headerRisk.textContent = risk.label;
      ui.mobileScore.textContent = result.total;
      ui.mobileRisk.textContent = risk.label;
      ui.totalScore.textContent = result.total;
      ui.riskSummary.textContent = `คะแนนรวม ${result.total} คะแนน: ${risk.label}`;
      ui.riskBadge.textContent = risk.label;
      ui.riskBadge.className = `risk-badge ${risk.key}`;
      ui.recommendation.innerHTML = `
        <h3>แนวทางตอบสนอง</h3>
        <p>${risk.action}</p>
        <span>ความถี่ประเมินซ้ำ: ${risk.frequency}</span>
      `;
      renderAlerts(result);
      renderBreakdown(result.details);
    }

    function renderEmptyResult() {
      ui.headerScore.textContent = "--";
      ui.headerRisk.textContent = "รอข้อมูล";
      ui.mobileScore.textContent = "--";
      ui.mobileRisk.textContent = "รอข้อมูล";
      ui.totalScore.textContent = "--";
      ui.riskSummary.textContent = "กรอกข้อมูลให้ครบเพื่อประเมินระดับความเสี่ยง";
      ui.riskBadge.textContent = "รอข้อมูล";
      ui.riskBadge.className = "risk-badge waiting";
      ui.recommendation.innerHTML = `
        <h3>แนวทางตอบสนอง</h3>
        <p>ระบบจะแสดงคำแนะนำหลังคำนวณคะแนน</p>
        <span>ความถี่ประเมินซ้ำ: --</span>
      `;
      ui.alertList.innerHTML = `<li class="muted">ยังไม่มีข้อมูลผิดปกติ</li>`;
      ui.breakdownList.innerHTML = `<p class="muted">ยังไม่ได้คำนวณ</p>`;
    }

    async function loadTeamAlertConfig() {
      try {
        const response = await fetch("api/config", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        teamAlertConfig = await response.json();
        if (teamAlertConfig.teamAlertAvailable) {
          updateTeamAlertStatus("LINE Alert พร้อมส่งเข้ากลุ่มทีมงาน", "ready");
        } else {
          updateTeamAlertStatus("LINE Alert ยังไม่ได้เชื่อมกับกลุ่มทีมงาน", "warning");
        }
      } catch (error) {
        teamAlertConfig.checked = false;
        updateTeamAlertStatus("LINE Alert backend ยังไม่พร้อม", "warning");
      }
    }

    function updateTeamAlertStatus(message, state) {
      if (!ui.teamAlertStatus) return;
      ui.teamAlertStatus.textContent = message;
      ui.teamAlertStatus.className = `team-alert-status ${state || "waiting"}`;
    }

    async function sendTeamAlert(result, allowPrompt = true) {
      const payload = buildTeamAlertPayload(result);
      const headers = { "content-type": "application/json" };
      const alertKey = localStorage.getItem(ALERT_KEY_STORAGE_KEY);

      if (alertKey) {
        headers["x-news-alert-key"] = alertKey;
      }

      try {
        const response = await fetch("api/alerts", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => ({}));

        if (response.ok && body.duplicate) {
          updateTeamAlertStatus("LINE Alert: เคสนี้เคยส่งแล้วในช่วงสั้น ๆ", "ready");
          return;
        }

        if (response.ok && body.sent) {
          updateTeamAlertStatus("ส่ง LINE Alert เข้ากลุ่มทีมงานแล้ว", "ready");
          showToast("ส่ง LINE Alert เข้ากลุ่มทีมงานแล้ว");
          return;
        }

        if (response.status === 401 && allowPrompt) {
          const newKey = window.prompt("กรอกรหัสทีมสำหรับส่ง LINE Alert");
          if (newKey) {
            localStorage.setItem(ALERT_KEY_STORAGE_KEY, newKey.trim());
            await sendTeamAlert(result, false);
            return;
          }
          updateTeamAlertStatus("LINE Alert ยังไม่ถูกส่ง: ต้องกรอกรหัสทีม", "error");
          return;
        }

        if (response.status === 401) {
          updateTeamAlertStatus("LINE Alert ยังไม่ถูกส่ง: รหัสทีมไม่ถูกต้อง", "error");
          return;
        }

        if (response.status === 503 && body.error === "line_not_configured") {
          updateTeamAlertStatus("LINE Alert ยังไม่ได้เชื่อม token/groupId", "warning");
          showToast("แสดง Alert ในเครื่องแล้ว แต่ยังไม่ได้เชื่อม LINE");
          return;
        }

        updateTeamAlertStatus("ส่ง LINE Alert ไม่สำเร็จ กรุณาแจ้งทีมด้วยวิธีสำรอง", "error");
        showToast("ส่ง LINE ไม่สำเร็จ กรุณาแจ้งทีมด้วยวิธีสำรอง");
      } catch (error) {
        updateTeamAlertStatus("ส่ง LINE Alert ไม่สำเร็จ กรุณาแจ้งทีมด้วยวิธีสำรอง", "error");
        showToast("ส่ง LINE ไม่สำเร็จ กรุณาแจ้งทีมด้วยวิธีสำรอง");
      }
    }

    function buildTeamAlertPayload(result) {
      const input = getInput();
      return {
        assessedAt: input.assessedAt ? new Date(input.assessedAt).toISOString() : new Date().toISOString(),
        patientName: input.patientName,
        hn: input.hn,
        gestAge: input.gestAge,
        total: result.total,
        riskKey: result.risk.key,
        riskLabel: result.risk.label,
        action: result.risk.action,
        frequency: result.risk.frequency,
        alerts: result.alerts.map((item) => item.message)
      };
    }

    function updateScorePill(key, detail) {
      const pill = document.getElementById(`${key}Score`);
      if (!pill) return;
      if (!detail) {
        pill.textContent = "รอข้อมูล";
        pill.className = "score-pill pending";
        return;
      }
      if (detail.status !== "ok") {
        pill.textContent = detail.status === "missing" ? "รอข้อมูล" : "ตรวจค่า";
        pill.className = `score-pill ${detail.status === "invalid" ? "invalid" : "pending"}`;
        return;
      }
      pill.textContent = `Score ${detail.score}`;
      pill.className = `score-pill score-${detail.score}`;
    }

    function renderAlerts(result) {
      const alerts = result.alerts;
      const criticalAlerts = result.criticalAlerts;

      if (!alerts.length) {
        ui.alertList.innerHTML = `<li class="muted">ไม่พบค่าผิดปกติตามตารางนี้</li>`;
        return;
      }

      const items = alerts.map((item) => {
        const className = item.score === 3 ? "alert-high" : item.score === 2 ? "alert-medium" : "alert-low";
        return `<li class="${className}">${escapeHtml(item.message)}</li>`;
      });

      if (isEscalationRisk(result)) {
        items.unshift(`<li class="alert-high">${escapeHtml(getEscalationCopy(result).description)}</li>`);
      } else if (criticalAlerts.length) {
        items.unshift(`<li class="alert-high">พบค่า Score 3 อย่างน้อย ${criticalAlerts.length} รายการ ควรทวนค่าและติดตามใกล้ชิดตามแนวทางหน่วยงาน</li>`);
      }

      ui.alertList.innerHTML = items.join("");
    }

    function renderBreakdown(details) {
      ui.breakdownList.innerHTML = details.map((item) => {
        const valueText = item.displayValue || item.value || "-";
        const scoreText = item.score === null ? "-" : item.score;
        return `
          <div class="breakdown-item">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(valueText)} • ${escapeHtml(item.rule)}</span>
            <em>Score ${scoreText}</em>
          </div>
        `;
      }).join("");
    }

    function updateButtons() {
      const ready = Boolean(currentResult && currentResult.complete);
      ui.saveButton.disabled = !ready;
      ui.printButton.disabled = !ready;
    }

    function openAlertPopup(result) {
      renderAlertPopupContent(result);
      closeAlertBanner();
      ui.alertModal.hidden = false;
      ui.ackAlertButton.focus();
    }

    function showAlertBanner(result) {
      const escalationCopy = getEscalationCopy(result);
      const patientText = getPatientDisplayText();
      const keyAlert = result.criticalAlerts[0] || result.alerts[0];
      const alertText = keyAlert ? keyAlert.message : result.risk.action;

      renderAlertPopupContent(result);
      closeAlertPopup();
      ui.bannerTime.textContent = "เมื่อสักครู่";
      ui.bannerTitle.textContent = `${escalationCopy.title} • NEWS ${result.total}`;
      ui.bannerMessage.textContent = `${patientText}: ${alertText}`;
      ui.alertBanner.className = `alert-banner ${result.risk.key}`;
      ui.alertBanner.hidden = false;
      window.requestAnimationFrame(() => {
        ui.alertBanner.classList.add("show");
      });

      playAlertSound(result.risk.key, soundEnabled);
      triggerVibration(result.risk.key);
      sendSystemNotification({
        title: `⚠️ Newborn NEWS: ${result.risk.label} (${result.total} คะแนน)`,
        body: `${patientText}: ${alertText}`,
        tag: `newborn-news-${patientText}-${result.risk.key}`,
        requireInteraction: result.risk.key === "high",
        onClick: () => openAlertPopup(result)
      });
    }

    function renderAlertPopupContent(result) {
      const escalationCopy = getEscalationCopy(result);
      ui.alertTitle.textContent = escalationCopy.title;
      ui.modalScore.textContent = result.total;
      ui.modalRisk.textContent = result.risk.label;
      ui.alertDescription.textContent = escalationCopy.description;
      ui.modalAction.textContent = result.risk.action;
      ui.modalFrequency.textContent = `ความถี่ประเมินซ้ำ: ${result.risk.frequency}`;
      ui.modalAlertList.innerHTML = result.alerts.map((item) => `<li>${escapeHtml(item.message)}</li>`).join("");
    }

    function closeAlertPopup() {
      ui.alertModal.hidden = true;
    }

    function closeAlertBanner() {
      ui.alertBanner.classList.remove("show", "medium", "high");
      ui.alertBanner.hidden = true;
    }

    function getPatientDisplayText() {
      const input = getInput();
      if (input.patientName) return input.patientName;
      if (input.hn) return `HN ${input.hn}`;
      return "ไม่ระบุผู้ป่วย/เตียง";
    }

    function saveCurrentRecord() {
      const record = buildRecord(currentResult);
      const records = loadRecords();
      records.unshift(record);
      saveRecords(records.slice(0, 200));
      renderHistory();
      showToast("บันทึกผลประเมินแล้ว");
    }

    function buildRecord(result) {
      const input = getInput();
      return {
        id: (global.crypto && global.crypto.randomUUID) ? global.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        assessedAt: input.assessedAt ? new Date(input.assessedAt).toISOString() : new Date().toISOString(),
        patientName: input.patientName,
        hn: input.hn,
        gestAge: input.gestAge,
        bt: Number(input.bt),
        hr: Number(input.hr),
        rr: Number(input.rr),
        spo2: Number(input.spo2),
        breathing: result.details.find((item) => item.key === "breathing")?.displayValue || "",
        neuroColor: result.details.find((item) => item.key === "neuroColor")?.displayValue || "",
        total: result.total,
        riskKey: result.risk.key,
        riskLabel: result.risk.label,
        action: result.risk.action,
        frequency: result.risk.frequency,
        alerts: result.alerts.map((item) => item.message)
      };
    }

    function loadRecords() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (error) {
        console.warn("Cannot load NEWS history", error);
        return [];
      }
    }

    function saveRecords(records) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    function renderHistory() {
      const records = loadRecords();
      ui.exportButton.disabled = records.length === 0;
      ui.clearHistoryButton.disabled = records.length === 0;

      if (!records.length) {
        ui.historyBody.innerHTML = `<tr><td colspan="8" class="empty-row">ยังไม่มีประวัติที่บันทึก</td></tr>`;
        return;
      }

      ui.historyBody.innerHTML = records.slice(0, 50).map((record) => `
        <tr>
          <td>${escapeHtml(formatDisplayDate(record.assessedAt))}</td>
          <td>
            <strong>${escapeHtml(record.patientName || "ไม่ระบุ")}</strong>
            <br><span class="muted">${escapeHtml(record.hn || "-")}${record.gestAge ? ` • ${escapeHtml(record.gestAge)}` : ""}</span>
          </td>
          <td>${escapeHtml(Number(record.bt).toFixed(1))}</td>
          <td>${escapeHtml(record.hr)}</td>
          <td>${escapeHtml(record.rr)}</td>
          <td>${escapeHtml(record.spo2)}</td>
          <td class="score-cell">${escapeHtml(record.total)}</td>
          <td><span class="risk-badge ${escapeHtml(record.riskKey)}">${escapeHtml(record.riskLabel)}</span></td>
        </tr>
      `).join("");
    }

    function exportCsv() {
      const records = loadRecords();
      if (!records.length) return;

      const headers = [
        "assessed_at",
        "patient_name",
        "hn",
        "gest_age",
        "bt",
        "hr",
        "rr",
        "spo2",
        "breathing",
        "color_consciousness",
        "total_score",
        "risk",
        "action",
        "frequency",
        "alerts"
      ];

      const rows = records.map((record) => [
        record.assessedAt,
        record.patientName,
        record.hn,
        record.gestAge,
        record.bt,
        record.hr,
        record.rr,
        record.spo2,
        record.breathing,
        record.neuroColor,
        record.total,
        record.riskLabel,
        record.action,
        record.frequency,
        (record.alerts || []).join(" | ")
      ]);

      const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `newborn-news-history-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function showToast(message) {
      ui.toast.textContent = message;
      ui.toast.classList.add("show");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        ui.toast.classList.remove("show");
      }, 2400);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  global.NewbornNEWS = {
    NUMERIC_FIELDS,
    SELECT_FIELDS,
    RISK_LEVELS,
    calculateNEWS,
    getRisk,
    isEscalationRisk,
    scoreNumeric,
    scoreSelect
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.NewbornNEWS;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initializeApp);
  }
})(typeof window !== "undefined" ? window : globalThis);
