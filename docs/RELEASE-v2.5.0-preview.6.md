# DragonStrap v2.5.0-preview.6

Adds an integrated CPU temperature reader using the official LibreHardwareMonitor 0.9.6 library and an existing PawnIO installation. A separate monitoring application is no longer required. CPU hardware monitoring only; no fan controls, clocks or voltages are changed.

Uses the CPU package/Tctl-Tdie reading when available, otherwise the hottest valid CPU sensor. Zero, nonfinite and out-of-range readings are rejected. Clear statuses distinguish administrator access, missing driver and unsupported sensor. Existing WMI sensor integrations remain available.

On the test Ryzen 7 5700 PC, the installed PawnIO 2.1.0 driver was already running. A read-only administrator probe returned Core (Tctl/Tdie) at 73.5 degrees Celsius. Normal access could not read the sensor. Run DragonStrap as administrator for direct CPU temperature on this configuration. No driver installation or system permission change is applied automatically.

Unsigned preview. No VirusTotal report was generated for this build.

Final integrated service verification returned CPU 84.6 C, GPU 77.25 C and Roblox PID 25696 at 84.1 FPS (248 frame samples). All 216 tests passed. These are point-in-time samples, not a temperature or performance guarantee.
