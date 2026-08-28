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
- This is a calculation aid only. Confirm thresholds and escalation policy with the clinical unit before real clinical use.
