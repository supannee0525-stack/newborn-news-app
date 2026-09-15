# Newborn Early Warning Sign Score (NEWS)

Static web app for calculating a newborn early warning score from:

- BT
- HR
- RR
- SpO2
- Breathing pattern
- Skin color / consciousness
- Blood pressure (SBP, DBP, MAP, PP) against GA/DOL-specific targets

The score ranges and escalation bands are transcribed from the user-provided NEWS chart image.
Blood pressure targets are transcribed from the user-provided `ตาราง_BP_targets.xlsx` for GA 24-42 and DOL bands D1-3, D4-14, and >D14. Blood pressure status is shown separately and is not added to NEWS Score because the source table does not define a 0-3 score.
MAP is calculated automatically to one decimal place from `DBP + ((SBP - DBP) / 3)` and is not entered manually.
PP (pulse pressure) is calculated automatically from `SBP - DBP` and is not entered manually. Only SBP and DBP are entered, under the vital signs section.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

## Notes

- History is stored in the browser via `localStorage`.
- History stays in the browser. When LINE alerts are enabled, Medium Risk and High Risk alert payloads are sent to the server so it can forward them to the team LINE group.
- The urgent in-app alert appears first as a mobile-style top notification banner for Medium Risk (5-6) and High Risk (7+). Tapping the banner opens the detailed popup.
- A blood pressure value below its GA/DOL target also opens a local alert and is included in Medium/High LINE summaries.
- This is a calculation aid only. Confirm thresholds and escalation policy with the clinical unit before real clinical use.

## LINE alert option

Automatic LINE alerts use `server.js` plus LINE Messaging API credentials:

- LINE Official Account with Messaging API enabled
- Channel access token
- Channel secret for webhook verification
- Recipient ID, such as user ID or group ID
- A privacy decision on what patient identifiers may be sent to LINE

Do not put a LINE access token directly in browser JavaScript.

Copy `newborn-news-alert.env.example` to `/etc/newborn-news-alert.env`, fill the LINE values, then restart `newborn-news-alert.service`.
