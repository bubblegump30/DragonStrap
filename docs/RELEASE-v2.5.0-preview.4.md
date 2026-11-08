# DragonStrap v2.5.0-preview.4

Replaces the combined FPS/temperature placeholder with independent GPU temperature, CPU temperature and measured Roblox FPS fields.

GPU temperature reads NVIDIA driver sensors. CPU temperature reads CPU sensors exposed by LibreHardwareMonitor/OpenHardwareMonitor WMI. FPS uses bundled official PresentMon 2.6.0, a three-second ETW presentation sample per Roblox PID, with the dominant swap chain selected. Missing providers and Windows capture permissions are reported explicitly; no synthetic FPS or temperature is displayed.

Sampling runs asynchronously only while Monitoring is visible, with overlapping calls coalesced and an eight-second cache. No startup telemetry work, game injection, driver installation or automatic privilege elevation.

Verification: 212 tests passed. Local NVIDIA RTX 3060 sensor returned 74.59°C. PresentMon returned access denied under the current Windows account token; live FPS measurement is not verified on this PC. Run DragonStrap as administrator when FPS capture is needed, or arrange Performance Log Users access through Windows. No CPU WMI sensor provider was detected, so actual CPU temperature remains unverified.

Unsigned preview; no VirusTotal scan was performed for this build. Existing accounts, settings and game-launch handoff retained.
