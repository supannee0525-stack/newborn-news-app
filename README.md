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
- No patient data is sent to the server.
- The urgent in-app alert appears first as a mobile-style top notification banner for Medium Risk (5-6) and High Risk (7+). Tapping the banner opens the detailed popup.
- This is a calculation aid only. Confirm thresholds and escalation policy with the clinical unit before real clinical use.

## LINE alert option

Automatic LINE alerts need a small server-side endpoint plus LINE Messaging API credentials:

- LINE Official Account with Messaging API enabled
- Channel access token
- Recipient ID, such as user ID or group ID
- A privacy decision on what patient identifiers may be sent to LINE

Do not put a LINE access token directly in browser JavaScript.
