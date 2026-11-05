Step 5 was shortened for the submission deadline; the full acceptance pass is incomplete. The first three defects below were found and fixed before this pass. Do not claim 2-metre readability or the full phone checklist passed.

| Date | Screen | Defect found (how) | Fix | Principle violated |
| --- | --- | --- | --- | --- |
| 5 Nov 2026 | Rest | Countdown overflowed, then over-shrank after the first patch; found in user screenshots. | Fixed with label-width/em sizing. Verified visually at supplied width, not at two metres. | Readable, unclipped system status. |
| 5 Nov 2026 | Workout edit sheet | kg step was 0.5 instead of the settled 2.5; found in code review. | Fixed kg main/sheet step to 2.5. User observed 2.5 → 5 in finished-set editing. | Consistency / error prevention. |
| 5 Nov 2026 | Settings | Global input rules stretched radios and checkboxes; found in a user screenshot. | Scoped input CSS. Fixed layout visually confirmed. | Readable labels and usable controls. |
| 5 Nov 2026 | Phone header | Nav overflow made the whole page slide sideways; found by phone check. | Nav-only scrolling and nonshrinking links added. User confirmed nav swipes while the page stays fixed. | Usable navigation without page overflow. |
| 5 Nov 2026 | Routines | Sample deletion warning claimed past sessions are kept, contrary to the sample cascade; found in code review. | Conditional warning implemented and source-verified. On-phone copy verification inconclusive because the sample was deleted. | Honest destructive-action warnings. |

## Unverified / deferred checks

These are not recorded as defects or as passes:

- Full keyboard-only flow
- Exact 390px all-screen check
- 200% zoom
- Contrast audit
- Two-metre timer readability and full phone screen pass
- Storage failure paths
- Zero-second rest / immediate refresh
- Session note persistence
- Sample-history cascade behavior
- Malformed / wrong-version import rejection
- Delete-all / import restore
- lb behavior (user declined)
- Device vibration / Wake Lock

PWA and offline checks belong to Step 5.5 and are not started.
