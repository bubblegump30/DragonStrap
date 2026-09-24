## Summary

Describe what changed and why.

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] UI/UX change
- [ ] Performance/reliability improvement
- [ ] Architecture/refactor
- [ ] Documentation
- [ ] Build/release change

## Affected areas

List the DragonStrap centers, services, or files affected by this pull request.

## Validation

Check the commands you ran:

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run release:verify`
- [ ] `npm run pack:win` (when packaging is affected)
- [ ] `npm run dist:win` (when release output is affected)
- [ ] Application startup/manual smoke test

Documentation-only pull requests may mark unrelated runtime checks as not applicable.

## Security and reliability review

- [ ] No secrets, Roblox authentication cookies, tokens, private keys, or sensitive logs are included.
- [ ] Electron main/preload/renderer privilege boundaries remain intact.
- [ ] Privileged IPC or system-changing operations are validated appropriately.
- [ ] Update, hash-verification, rollback, recovery, and destructive-operation safeguards are not weakened.
- [ ] Unsupported/unavailable states fail safely.

## UI changes

If this changes the interface, include before/after screenshots and confirm that the result remains consistent with DragonStrap's Purple Dragon UI/UX.

## Release impact

Describe any installer, portable build, update, migration, rollback, FastFlag, or compatibility implications.

## Checklist

- [ ] The change is focused and does not include unrelated refactoring.
- [ ] Documentation was updated when behavior changed.
- [ ] I reviewed the final diff for accidental files and generated build output.
- [ ] The change is ready for maintainer review.
