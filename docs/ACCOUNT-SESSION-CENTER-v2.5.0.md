# DragonStrap Account & Session Center — v2.5.0 development

Build version: **2.5.0-preview.3**.

This is a local, unreleased source milestone based on GitHub main 08d7fd4cc92097d186d66c0c013c2719c667feba plus the maintenance fixes from this chat. The published release remains v2.4.1. New code is isolated in renderer/manager.js, renderer/manager.css, account/session services, a Windows helper and typed preload calls.

## Feature matrix

| Reference feature | Implementation and practical boundary |
| --- | --- |
| Saved accounts | Official Roblox sign-in in an isolated, nonpersistent browser session; optional masked session-cookie import; account verification, aliases, tags, favorites, refresh and removal. No Roblox password storage. |
| Avatars and R$ | Roblox-provided thumbnail and balance refresh after connection/manual refresh. Missing provider data is unavailable rather than zero. Images are restricted to Roblox CDN hosts. |
| Games and servers | Per-account Place IDs, game URLs, specific-server deep links, privateServerLinkCode/accessCode links, custom names, icons, favorites, rename/delete and launch. Share-code-only URLs without a Place ID must first be resolved on Roblox to a game URL. |
| Multiple accounts | Authenticated account launch attempts and a concurrency preference. Roblox decides whether multiple Player clients remain open. No client patching, singleton-handle removal or compatibility guarantee. |
| FPS / potato mode | Legacy FPS and minimum-MSAA targets applied before launch, with an automatic recovery restore point. These share the detected installation's ClientSettings and may be ignored by Roblox. No asset deletion or fabricated FPS readout. |
| Session viewer | Managed PID/start-time/executable identity, memory, CPU sample percentage, responding state, tracked elapsed time, focus/minimize, working-set trim and stop. Other Roblox processes are monitoring-only. |
| Automatic restart | Opt-in per account; detected unexpected exits after 30 seconds can trigger at most three relaunch attempts. Explicit Stop never restarts. A normal game exit cannot always be distinguished from a crash. |
| Anti-AFK | Opt-in per account, delay 250 ms–10 s, cycle 5–18 min. Sends two Space taps only to the foreground managed Roblox window after 60 s Windows inactivity and with no held key/mouse button. Never steals focus. Background clients are skipped; game acceptance is unverified. |
| CPU tuning | Below Normal priority, Windows EcoQoS and opt-in per-session single logical-core affinity, with original affinity restoration. Windows denial is reported. |
| Memory controls | Lower memory priority, an optional soft resident working-set target, and trimming 30 s after launch then every 35 min. Zero restores the captured original working-set target. These do not cap committed memory and can cause paging/stutter. |
| Scheduler | Persistent account/game launch and stop jobs; claims jobs before executing, records failures, cancels pending jobs, marks jobs more than five minutes late as missed. App must remain open. Interrupted jobs are not replayed. |
| Shutdown timer | A 0–1440 minute timer stops only managed Roblox sessions; zero cancels it. It does not shut down the PC. |
| Statistics / levels | Locally tracked session count, time, level and achievements; independent of Roblox's game rewards. Counts/time are saved when sessions end or detach on manager exit. |
| Appearance | Neo Purple, Amethyst and Midnight manager palettes, custom colors and named saved skins. Gaming/Light/Low GPU effects apply to DragonStrap; custom palette colors apply to the account center. Existing artwork and shell branding remain. |
| Native window UI | Default Windows title bar/border; optional borderless managed window request. Original style is captured for restoration; Windows may refuse changes. |
| Log cleanup | Opt-in hourly cleanup: logs older than 24 h or folder pressure above 50 MB; files modified within one hour are retained. |
| Old version cleanup | Opt-in, allowlisted old version directories only. Keeps current Player/Studio, running versions, newest two, all folders with ClientSettings, and anything newer than seven days. |
| Crash dumps | Opt-in .dmp cleanup in allowlisted Roblox log/crash directories, preserving the latest 24 h. |
| Windows multi-instance tuning | Reads GDI quota and page-file status. Optional GDI quota increase to at least 20,000 requires a separate confirmation and Windows UAC; original quota is saved and restorable. A reboot is required. Page-file settings are not changed. |
| Actual FPS, CPU/GPU temperatures | No measurement provider is bundled, so these are shown as unavailable. |
| Discord | A sidebar label in the reference does not specify a Discord integration. No bot, server changes or Discord-account actions were invented. |

## Credentials and boundaries

Credentials are stored separately from account metadata in account-vault.json using Electron's asynchronous OS-backed safeStorage API. There is no plaintext fallback; unavailable encryption blocks saving. The Windows provider protects against other Windows users, not arbitrary software running as the same Windows user. Credentials and launch tickets are excluded from renderer state, monitoring, statistics and metadata.

Roblox sign-in windows have no application preload, Node integration or IPC bridge. Top-level navigation stays on HTTPS Roblox domains. Their in-memory browser session is cleared on close. Cookie import is explicit and masked. Account verification and ticket requests go only to fixed Roblox endpoints and reject redirects. Preview.3 verified one normal saved-game launch through the registered handler. Other provider scenarios still need separate acceptance; credentials belong directly in the app, never in chat.

Process mutation requests use only a main-process managed session identity and require matching PID, start time, executable path and RobloxPlayerBeta process name. Scheduler jobs and stop-all use those same controls. Closing DragonStrap detaches Roblox and stops automation. No existing Roblox process was changed during development verification.

Cleanup refuses links/junctions along target paths and paths outside its Roblox root. Cleanup defaults off and can be previewed. No actual user logs, dumps or versions were removed during development tests. GDI tuning is built but was not applied to this PC during verification.

## Verification and acceptance

- Automated source, service and UI checks are recorded in the delivery report.
- Windows helper policy/restore/trim/identity-refusal/stop were exercised against a disposable Node process renamed RobloxPlayerBeta.exe, not the real game.
- Windows safeStorage encryption/decryption was exercised using a synthetic secret.
- UI checks use synthetic accounts and sessions; preview screenshots are layout evidence, not live account or game evidence.
- Live acceptance still required for official browser sign-in UI, private/specific-server authorization, concurrency behavior, real Roblox process-policy acceptance, idle-input effectiveness and opt-in exit recovery. Preview.3 verified saved-session identity/ticket use and a normal game join for one saved account. A subsequent preview.3 verification used the normal encrypted runtime API for one saved account, without printing or exporting its credentials. Fresh log evidence confirmed that account joining the requested normal saved game.
- Admin GDI apply/restore was tested at the command-construction boundary only. No UAC or registry mutation was executed.
- Build artifacts remain unsigned. No previous VirusTotal report applies to a new executable.

## Sources consulted for implementation constraints

- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): asynchronous encryption and Windows protection boundary.
- [Microsoft process information](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation): CPU efficiency and memory-priority policies.
- [Microsoft working-set information](https://learn.microsoft.com/en-us/windows/win32/psapi/working-set-information): resident memory and trimming semantics.
- [Microsoft SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput): input delivery and privilege restrictions.
- [Roblox account endpoints](https://create.roblox.com/docs/cloud/reference/features/accounts), [user data](https://create.roblox.com/docs/cloud/reference/features/users), and [thumbnails](https://create.roblox.com/docs/cloud/reference/features/thumbnails).

Account launches honor the global Performance auto-apply switch. Disable all Player flags continues to keep launch-time FPS/MSAA overrides off.
