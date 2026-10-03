# DragonStrap v2.4.1 — Disable all Player FastFlags

FastFlags now has **Disable all flags** and **Restore disabled flags**.

- Disable all removes every custom Player override, including LOCKED Performance Center keys, after confirmation.
- The complete previous set is saved beside the current Player configuration. Repeated disable clicks on an empty configuration do not erase it.
- Pre-launch Performance auto-apply is switched off, including per-experience tuning on launch.
- Restore disabled flags replaces current overrides with the saved set, including locked values. It does not change auto-apply preferences.
- Pending edits are discarded after success. Restart Roblox for changes to take effect.

This controls local Player overrides. Studio uses its own separate controls. Presets and profiles remain available; manually applying them or Performance settings can add overrides again.

## Downloads

- **Setup (x64):** `DragonStrap-Setup-2.4.1-x64.exe`
- **Portable (x64):** `DragonStrap-Portable-2.4.1-x64.exe`
- **Integrity:** Compare the SHA-256 hash of each download with `SHA256SUMS.txt`.

These Windows packages are unsigned. Existing local settings are retained. Windows CI runs source checks, 166 automated tests, release verification, and Electron layout checks at multiple window sizes and scaling levels before packaging.

The VirusTotal report for v2.4.0 describes the previous installer and does not cover these new files.
