"use strict";

const assert = require("node:assert/strict");
const news = require("./app.js");

const example = news.calculateBloodPressure({
  gestAge: "30",
  dol: "7",
  sbp: "49",
  dbp: "20",
  pp: "12"
});

assert.equal(example.complete, true);
assert.deepEqual(example.target, { sbp: 51, dbp: 28, map: 36, pp: 17 });
assert.equal(example.periodLabel, "D4-14");
assert.equal(example.calculatedMap, 29.7);
assert.equal(example.alerts.length, 4);
assert.equal(news.calculateMAP("49", "20"), 29.7);

assert.equal(news.getBloodPressureTarget("24+6", "1").periodLabel, "D1-3");
assert.equal(news.getBloodPressureTarget("42 wk", "15").periodLabel, "> D14");
assert.equal(news.getBloodPressureTarget("23", "1").status, "invalid");

const normal = news.calculateBloodPressure({
  gestAge: "30+2",
  dol: "14",
  sbp: "52",
  dbp: "28",
  pp: "17"
});
assert.equal(normal.complete, true);
assert.equal(normal.alerts.length, 0);

const confirmedGa36 = news.calculateBloodPressure({
  gestAge: "36",
  dol: "4",
  sbp: "36",
  dbp: "34",
  pp: "20"
});
assert.equal(confirmedGa36.complete, true);
assert.deepEqual(confirmedGa36.target, { sbp: 36, dbp: 34, map: 44, pp: 20 });
assert.equal(confirmedGa36.calculatedMap, 34.7);
assert.equal(confirmedGa36.alerts.length, 1);
assert.equal(confirmedGa36.alerts[0].key, "map");

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
  pp: "12"
});
assert.equal(scored.total, 0);
assert.equal(scored.risk.key, "normal");
assert.equal(scored.alerts.length, 4);
assert.equal(news.shouldShowLocalAlert(scored), true);

console.log("Blood pressure target tests passed");
