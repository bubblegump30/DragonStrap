# Account workflows — v2.6.0

## Groups

Open Accounts. Use New group, or select a group in the filter before Rename group/Remove group. Group names are unique ignoring case, with a 40-character name and a maximum of 32 groups. Removing a group makes its accounts ungrouped; it does not delete accounts, games, schedules or credentials.

To assign accounts, select their checkboxes, choose Move accounts to group, choose a destination (or Ungrouped), and Apply to selected. The change commits atomically for the whole selection. Existing account files need no manual migration; older accounts start ungrouped. Encryption remains in the existing account vault.

## Bulk actions

Select visible adds all currently filtered accounts to the selection. Search and group changes retain selection. Clear selection removes it. The selected count includes rows hidden by filters, so inspect it before applying an action.

- Refresh Roblox details verifies each stored session and refreshes available profile data. An expired session fails that account without blocking later accounts.
- Favorite/unfavorite applies to account ordering; a favorite saved game is a separate setting in each account editor.
- Launch favorite games opens a review with each chosen game/Place ID. Missing favorites are reported without substituting a different game. A favorite changed after review is refused. More than one selected launch requires enabling concurrent launch attempts in Manager settings. Roblox may close another client; DragonStrap does not patch Roblox.
- Stop selected managed sessions reviews the managed sessions for each account. Unmanaged Roblox Players are not targeted. A replacement session not included in the review is refused; review again to stop it.

Remote/process actions run one at a time. A result table reports each account independently. Cancel remaining skips accounts not started yet; the current request may finish. Stop all also cancels remaining favorite launches. Closing DragonStrap stops later batch work and retains the existing detach behavior. Dispatched Windows protocol handoffs cannot be recalled.

## History

Sessions displays active managed clients. History retains the newest 1,000 ended records, while lifetime statistics retain their existing totals. Search games/accounts and filter by account/outcome. The view uses 50-entry pages and includes local start/end times, tracked time and join confirmation when available.

Stopped means DragonStrap stopped the managed session. Exited means the process disappeared; it is not proof of a crash. Detached means the manager closed and left Roblox running. Historical account labels remain after account removal. Hide details masks account/game labels in the history view.

History, groups and results contain metadata, not stored session cookies or authentication tickets. Older history without name/join fields remains readable. Group migration and synthetic test evidence are described in RELEASE-v2.6.0.md. Real multi-account compatibility remains dependent on Roblox and needs separate live acceptance.
