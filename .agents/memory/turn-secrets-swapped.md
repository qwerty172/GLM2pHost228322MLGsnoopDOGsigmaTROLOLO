---
name: TURN secrets swapped
description: TURN_URL and TURN_CREDENTIAL secret values are stored swapped; server auto-corrects.
---
The stored values of TURN_URL and TURN_CREDENTIAL are swapped (TURN_URL contains the credential string). The `/public/ice-config` route detects an invalid ICE URI in TURN_URL and swaps them before serving the config.
**Why:** secrets can't be set programmatically; without correction RTCPeerConnection throws "not a valid URI".
**How to apply:** if a user re-enters the secrets correctly, the auto-swap logic is a no-op (it only swaps when TURN_URL isn't a valid ICE URI). Don't remove the guard.
