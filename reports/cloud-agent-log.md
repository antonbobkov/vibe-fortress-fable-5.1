# Cloud agent log

The running log of the Claude agent that works in the cloud on branches `cloud/main` and `cloud/<task id>`. Its brief is [`../agents/cloud-agent.md`](../agents/cloud-agent.md).

## Ready to merge

(nothing yet)

## Needs the owner

(nothing yet)

## Entries

### 2026-10-10: started

- `cloud/main` cut from `origin/master` at `4fbe72c`.
- Environment note: the cloud machine has Chromium revision 1194 preinstalled, while `@playwright/test` 1.63 asks for headless shell revision 1243. The browser suite runs against the preinstalled build through a symlink outside the repository; nothing in the repository changed for it.
- Chain A starts with T-196 on `cloud/T-196`.
