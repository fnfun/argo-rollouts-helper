# Argo Rollouts Promote Full Helper

> [中文文档](README_zh.md)

A Chrome extension that adds a one-click **Promote Full** toggle to the Argo Rollouts UI. When enabled, it intercepts `PUT /api/v1/rollouts/{ns}/{name}/promote` requests and rewrites the body from `{"full": false}` to `{"full": true}` — equivalent to running `kubectl argo rollouts promote --full`.

⚠️ **Full promote skips all remaining steps and releases immediately. Use with caution.** The banner turns red and pulses when the toggle is on.

---

## Features

- Only activates on URLs in the user-configured allowlist (default: `https://argo-rollouts.example.com/*`). Silent on all other pages.
- Injects a prominent banner at the top of active pages:
  - **Off state**: clean white/dark bar (follows system theme), Argo orange logo, indicates the extension is loaded and not modifying any requests.
  - **On state**: entire bar turns red with a pulse animation and a warning message confirming "FULL PROMOTE ENABLED".
- Intercepts `PUT /api/v1/rollouts/{namespace}/{name}/promote` requests and rewrites the `full` field in the request body.
- Only processes JSON string bodies; non-JSON bodies are passed through unmodified.
- State and configuration are persisted via `chrome.storage.local` and synced across tabs.
- Provides an extension popup for managing the URL allowlist, checking whether the current page is active, and toggling the switch.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory
4. After the extension loads, click the toolbar icon to open the popup:
   - Click **Restore defaults** to add the default Argo URL to the list
   - Click **Save**
5. Refresh `https://argo-rollouts.example.com/` — the banner should appear at the top

## Usage

- **Toggle Promote Full**: click the switch in the banner at the top of the page, or use the toggle in the extension popup. Both are synced in real time.
- **Add other URLs** (e.g. an internal staging environment): in the popup, click **Add current page** → **Save** → refresh the page.
- **No side effects when off**: with the toggle off, all promote requests use Argo's default behavior and the extension does not modify any requests.

## Verification

Open the DevTools Network panel and trigger the `Promote` button in the Argo UI:

| Toggle state | Request payload |
| --- | --- |
| Off | `{"full":false}` |
| On | `{"full":true}` |

You can also test directly in the Console:

```js
fetch('/api/v1/rollouts/foo/bar/promote', { method: 'PUT', body: '{"full":false}' });
```

With the toggle on, the payload for this request in the Network panel will be rewritten to `{"full":true}`.

## Project Structure

```
manifest.json          MV3 manifest
src/
  content.js           Isolated world: URL gating + banner UI + state sync
  inject.js            Main world: overrides fetch / XMLHttpRequest
  banner.css           Banner styles (including pulse animation)
  popup.html/js/css    Extension popup (URL allowlist + quick toggle)
icons/                 16/48/128 placeholder icons
```

## Known Limitations

- After changing the URL pattern configuration, **already-open pages are not automatically re-injected or unloaded** — you must manually refresh for changes to take effect (the popup shows a reminder when saving).
- The extension requests `<all_urls>` in `host_permissions` (Chrome shows "Read and change all your data on all websites" at install time), but the content script checks storage on the very first line and returns immediately if the current URL doesn't match — zero side effects on non-configured pages.
- Only JSON string bodies are processed. The current Argo UI submits promote requests as JSON, so FormData / Blob handling is not needed.
- The `full` field is hardcoded in `inject.js`. If the Argo backend field name changes, `inject.js` must be updated manually.
