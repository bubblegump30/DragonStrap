# DragonStrap user tutorial

This guide covers DragonStrap **v2.0.4** on Windows 10/11. DragonStrap is a Roblox Player launcher and bootstrapper with separate controls for installation, performance, servers, Studio, and recovery. You can follow the first three sections to get started; the remaining sections explain optional features.

## 1. Download and open DragonStrap

1. Open the [latest DragonStrap release](https://github.com/bubblegump30/DragonStrap/releases/latest).
2. Download **DragonStrap-Setup-2.0.4-x64.exe** for the Windows installer, or **DragonStrap-Portable-2.0.4-x64.exe** to run the portable build. Use the file names from the latest release if its version is newer.
3. Optionally download `SHA256SUMS.txt` from the same release. In PowerShell, run `Get-FileHash -Algorithm SHA256 .\DragonStrap-Setup-2.0.4-x64.exe` (substitute your downloaded file name) and compare its hash with the matching line in `SHA256SUMS.txt`.
4. Run the Setup installer or open the Portable executable. Let the initial Roblox installation scan finish.

The **Home → Roblox Overview** and **Installation Status** cards show whether Player and Studio were detected. **Instances** shows the detected version and executable paths. Studio is optional for Player use.

## 2. Install or update Roblox Player, if needed

If Player is missing or you want the deployment for a chosen channel:

1. Open **Channels** in the sidebar.
2. In **Channel Selection**, use **USE LIVE** for the production channel. To inspect another public channel, enter its name, choose **CHECK CHANNEL**, and then **SELECT CHANNEL** only if it is available and you intend to use it.
3. In **Roblox Player Installation Engine**, choose **ANALYZE INSTALL**. Review the target build, download size, installed size, and free space.
4. Choose **INSTALL / UPDATE PLAYER** and watch the progress. Let the download, verification, staging, and commit finish. **CANCEL** leaves partial downloads in the cache for a later resume.
5. Return to **Home** or **Instances** and refresh detection to confirm Player is ready.

The installation engine handles **Player**, while the Studio channel on the **Studio** page is for tracking and does not install Studio. If a Roblox update or network request fails, use **Recovery** for diagnostics before trying again.

## 3. Launch Roblox

- For a normal Player launch, press **PLAY** on **Home**, or open **Launch → Quick Launch** and press **LAUNCH** beside Roblox Player.
- To join an experience, open **Launch → Join Experience**, paste a Roblox game URL or enter its numeric Place ID, then press **JOIN EXPERIENCE**. Enter a **Game Instance ID** only when you have a specific server or Job ID.
- Choose the **Session Profile** on the Launch page before launching. The selected profile is recorded in **Recent Launches**. The **Minimize DragonStrap after a successful launch** option is available there too.
- To start Studio when installed, press **STUDIO** in **Launch → Quick Launch**, or use the **Studio** page.

Only Roblox experience links and supported Roblox deep links are accepted in the experience field. If launch is unavailable, check **Instances** for an installed executable, then use **Channels → ANALYZE INSTALL** for Player or inspect the **Launch Status** message.

## 4. Set up Performance Center

1. Open **Performance Center**. Review the hardware recommendation; it is guidance and does not apply by itself.
2. Select a built-in **Performance Profile** such as Default, Balanced, Performance, or Quality, or adjust **Frame Rate**, **Render Engine**, and **Anti-Aliasing**.
3. Choose **APPLY NOW** in **Applied State** to write DragonStrap-managed Player settings. **RESTORE ROBLOX DEFAULTS** removes those managed overrides.
4. Enable **Auto-apply before launch** if you want the chosen managed settings applied before Player launches through DragonStrap.
5. For one game, enter its numeric Place ID under **Per-Experience Profiles**, select a saved profile, and press **ASSIGN**. That assignment takes precedence when Launch Center starts that Place ID.

FPS and nondefault renderer overrides are marked compatibility-sensitive; a current Roblox build may ignore them. The live process card reports process information, and its CPU time is cumulative, not live CPU percentage. The **Applied State** card shows what DragonStrap wrote, not a guarantee of in-game performance.

## 5. Review FastFlags before applying

Open **FastFlags** to browse Player `ClientAppSettings.json`. Search or select a flag, inspect **Flag Intelligence** and its compatibility notes, then use **QUEUE SET** or **QUEUE REMOVE**. Review the exact changes in **Before / After** and press **APPLY CHANGES** only when the result is what you want. **DISCARD** clears pending edits.

**QUEUE EDITABLE SAFE CORE** also queues changes for review; it does not write immediately. Performance Center-owned keys are visible here but locked and should be edited in Performance Center. DragonStrap creates automatic snapshots before writes; **RESTORE BACKUP** and **RESTORE SELECTED SNAPSHOT** are available if you need to recover a previous file. Unknown or legacy flags may be ignored by Roblox, so inspect their warnings before using them.

## 6. Find and join a public server

1. Open **Servers** and enter a Place ID or Roblox game URL under **Server Lookup**.
2. Press **LOOK UP SERVERS**. Filter or sort the loaded public servers by region, occupancy, ping, or other displayed attributes. You can compare up to three servers and save favorites.
3. Use the join action on a server row to launch that instance. **Saved & Recent** provides shortcuts later.

Server lookups send the Place ID and public server IDs to RoValra for region and uptime enrichment. DragonStrap does not send your Roblox cookie. Region and ping information depends on the current provider response and available samples.

## 7. Work with Studio and profiles

- **Studio:** Open **Studio → OPEN PROJECT…** to choose a project through the file picker, or **LAUNCH BLANK STUDIO**. The page also has recent projects, a Studio launch profile, and optional local Auto Backup. Studio channel selection tracks deployment metadata only. Studio FastFlags are optional, disabled by default, and have a separate configuration boundary.
- **Performance profiles:** In **Performance Center → Configuration Profiles**, enter a name and use **SAVE CURRENT PROFILE** for a reusable FPS, renderer, and MSAA combination.
- **Complete configuration profiles:** In **Profiles → Capture Current Configuration**, name the current Player configuration and press **SAVE CURRENT**. Select a saved profile and inspect **Apply Preview** before **APPLY PROFILE**. This replaces the current *editable* Player FastFlag set with the profile's editable set; preview shows sets and removals. Use **CLONE SELECTED**, **EXPORT**, or **IMPORT PROFILE** for copies and sharing. Capture needs a detected Player and readable `ClientAppSettings.json`.

## 8. Update DragonStrap

Open **Settings → Update Center 2.0**. Select **Stable** or **Pre-release**, press **CHECK NOW**, read the release notes, then use **DOWNLOAD UPDATE** and **INSTALL UPDATE** when enabled. The app checks the official GitHub release feed and verifies downloaded binaries against the published SHA-256 checksum file. You can defer an offered update or open its release page.

The built-in binary install path applies to packaged **Setup** or **Portable** builds. If you run DragonStrap from source, update your source checkout and rebuild instead.

## 9. Diagnose and recover

Open **Recovery** and press the refresh button in **System Health** to run diagnostics. Use **CREATE** under **Configuration Restore Points** before trying significant configuration changes. Restore points cover allowlisted DragonStrap settings and Player/Studio ClientSettings; they do not include Studio project files, credentials, logs, or server history.

For an identified problem, use the focused action: **REPAIR CLIENT SETTINGS** for a malformed Player configuration, **REPAIR UPDATE STATE** for interrupted self-update state, or **ROLL BACK PLAYER** only when a trusted earlier installation is available. **RUN SAFE REPAIR** creates a restore point before attempting known recoverable repairs. **EXPORT DIAGNOSTICS** creates a troubleshooting report that excludes Roblox cookies, FastFlag values, and project contents.

The top-right DragonStrap name/version menu opens **Help** and **About**. You can also press **Ctrl+K** to search the app's navigation. For unresolved issues, include the DragonStrap version, the action you took, and the visible error when opening a [GitHub issue](https://github.com/bubblegump30/DragonStrap/issues).

## Run from source (developers)

On Windows 10/11 with Node.js, npm, and Windows `tar.exe`:

```powershell
git clone https://github.com/bubblegump30/DragonStrap.git
cd DragonStrap
npm install
npm start
```

Source mode disables binary self-application. To validate a source checkout, run `npm run check`, `npm test`, and `npm run release:verify`.

[Official website](https://www.purpledragonfoundationltd.xyz/) · [Repository](https://github.com/bubblegump30/DragonStrap) · [Releases](https://github.com/bubblegump30/DragonStrap/releases)
