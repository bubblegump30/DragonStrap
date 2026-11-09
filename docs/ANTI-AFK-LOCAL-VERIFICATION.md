# Anti-AFK verification and fixes - local development

The scheduler previously advanced its full cycle timer before knowing whether input was sent. A background window, held key or failed request could therefore postpone the next attempt by another complete interval. The local fix records a completed cycle only when the Windows helper explicitly confirms a sent tap. Skipped or failed attempts retry after 30 seconds while preserving the configured 5-18 minute cycle after a successful send.

The native helper now fails closed if idle time cannot be read, rechecks focus before input, checks for activity/held keys again after the configured action delay, and skips the second tap if activity, focus or process lifetime changed. It checks that the controller process is still alive. Space is held for 80 ms; key-up is attempted in a finally block, with one release retry if Windows refuses the first release. Windows may refuse synthetic input, and games may ignore it.

Verification:
- 259 unit tests passed, 0 failed.
- New scheduler tests cover skipped-cycle retry timing, failures/unconfirmed responses, configured interval/delay, process identity, opt-in/disable, stopped/unmanaged sessions and manager shutdown.
- Windows PowerShell parsed the shipped helper and compiled its C# declarations. INPUT layout matched the current architecture. No real SendInput call was made.
- The shipped Anti-AFK PowerShell branch passed fake-provider tests for idle foreground input, background windows, recent activity, held keys, focus/activity changes between taps, and failure to read idle time. Input provider calls were simulated.
- The actual account policy UI passed enable/save/indicator and disable/save/indicator checks with a synthetic account, plus its five layout configurations.
- Source/syntax, release consistency and whitespace checks passed.

How to use: restart the local preview, click the account's heart/Anti-AFK icon, enable Anti-AFK input, and save session settings. Account tools > Manager settings controls the cycle interval (5-18 minutes; default 18) and action delay. DragonStrap must remain open. Only an identified managed Player session is eligible, and Player must be foreground with Windows idle for at least 60 seconds. Background windows are skipped; DragonStrap never switches focus for Anti-AFK. Sessions shows the most recent cycle/waiting/error message.

A live in-game keep-alive test has not been performed. No real game received test keystrokes, and fixture results do not establish that every game accepts synthetic input. These fixes ship in v2.7.0; this document records the development verification. Historical v2.6.1 binaries and their scan hashes remain unchanged.
