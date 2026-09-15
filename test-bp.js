"use strict";

const assert = require("node:assert/strict");
const news = require("./app.js");

const example = news.calculateBloodPressure({
  gestAge: "30",
  dol: "7",
  sbp: "49",
  dbp: "20",
  map: "33",
  pp: "12"
});

assert.equal(example.complete, true);
assert.deepEqual(example.target, { sbp: 51, dbp: 28, map: 36, pp: 17 });
assert.equal(example.periodLabel, "D4-14");
assert.equal(example.alerts.length, 4);

assert.equal(news.getBloodPressureTarget("24+6", "1").periodLabel, "D1-3");
assert.equal(news.getBloodPressureTarget("42 wk", "15").periodLabel, "> D14");
assert.equal(news.getBloodPressureTarget("23", "1").status, "invalid");

const normal = news.calculateBloodPressure({
  gestAge: "30+2",
  dol: "14",
  sbp: "51",
  dbp: "28",
  map: "36",
  pp: "17"
});
assert.equal(normal.complete, true);
assert.equal(normal.alerts.length, 0);

const sourceAnomaly = news.calculateBloodPressure({
  gestAge: "36",
  dol: "4",
  sbp: "63",
  dbp: "34",
  map: "44",
  pp: "20"
});
assert.equal(sourceAnomaly.complete, false);
assert.match(sourceAnomaly.problems[0].message, /ต้องยืนยัน/);

const scored = news.calculateNEWS({
  gestAge: "30",
  dol: "7",
  bt: "36.8",
  hr: "140",
  rr: "48",
  spo2: "98",
  breathing: "normal",
  neuroColor: "pink-alert",
  sbp: "49",
  dbp: "20",
  map: "33",
  pp: "12"
});
assert.equal(scored.total, 0);
assert.equal(scored.risk.key, "normal");
assert.equal(scored.alerts.length, 4);
assert.equal(news.shouldShowLocalAlert(scored), true);

console.log("Blood pressure target tests passed");
