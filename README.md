# Newborn Early Warning Sign Score (NEWS)

Static web app for calculating a newborn early warning score from:

- BT
- HR
- RR
- SpO2
- Breathing pattern
- Skin color / consciousness

The score ranges and escalation bands are transcribed from the user-provided NEWS chart image.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

## Notes

- History is stored in the browser via `localStorage`.
- History stays in the browser. When LINE alerts are enabled, Medium Risk and High Risk alert payloads are sent to the server so it can forward them to the team LINE group.
- The urgent in-app alert appears first as a mobile-style top notification banner for Medium Risk (5-6) and High Risk (7+). Tapping the banner opens the detailed popup.
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
