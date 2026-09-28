# DragonStrap v2.3.2 — Easier UI verification

On Windows, extract the source ZIP and double-click Verify-UI.cmd. It finds the project folder, checks npm, installs dependencies if absent, runs npm run ui:verify, and leaves results visible. PowerShell users can still run npm install followed by npm run ui:verify from the project folder. The Electron harness now checks clipping across the main centers. This environment cannot execute Windows Electron, so a Windows visual pass remains required.
