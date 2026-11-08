# DragonStrap v2.5.0-preview.5

Fixes FPS capture parsing: PresentMon legacy output uses msBetweenPresents, while preview.4 expected MsBetweenPresents. Header lookup is now case insensitive and accepts BOMs, quoted CSV fields and full executable paths.

GPU temperature remains independent. CPU temperature still requires LibreHardwareMonitor or OpenHardwareMonitor CPU sensors exposed over WMI. Roblox running does not make CPU temperature sensors available. No driver installation or Windows permission changes are performed automatically.

FPS capture still requires Windows ETW permissions. The current diagnostic token returned access denied, so this fix is verified against the official legacy CSV format and regression fixtures, not a new live FPS capture on this PC.

Unsigned preview; no VirusTotal scan for this build. Retains registered game handoff and fast Folder startup.
