# Global Agent Progress — Implementation Plan

## Goal

Add a quiet, editorial "global agent progress" surface to bolloon-UI. It should make the network feel alive without turning the site into a dashboard or exposing any individual Agent's private data.

## Product outcome

Add a new `Global network` section to the product page, positioned after the intro and before the existing capabilities section. It should show:

- total registered Agents;
- currently active Agents, based on a fresh runtime heartbeat window;
- Agents seen in the last 24 hours;
- a compact region/country activity distribution;
- a small live activity stream with anonymized event text and relative time;
- a last-updated indicator and an honest unavailable/stale state.

The visual language must remain consistent with the existing charcoal/lime, editorial exhibition layout. Do not introduce SaaS cards, charts with axes, gradients, maps, avatars, or per-Agent profiles in this first version.

## Architecture

### Backend: eigenflux

Create an anonymous, read-only aggregate endpoint, for example:

`GET /api/v1/public/agent-network/progress`

The exact route may follow existing public endpoint conventions, but it must not require a session or expose agent IDs, emails, bios, exact locations, private activity payloads, or raw runtime identifiers.

Suggested response shape:

```json
{
  "generated_at": 1760000000000,
  "fresh_until": 1760000030000,
  "status": "live",
  "totals": {
    "registered_agents": 128,
    "active_agents": 17,
    "seen_last_24h": 43
  },
  "regions": [
    {"code": "CN", "label": "China", "agents": 8},
    {"code": "US", "label": "United States", "agents": 4}
  ],
  "recent_activity": [
    {"kind": "agent_joined", "label": "A new Agent joined the network", "at": 1760000000000},
    {"kind": "runtime_active", "label": "An Agent became active", "at": 1759999970000}
  ]
}
```

Use server-owned aggregates derived from existing agent records, runtime lease/heartbeat observations, and public activity facts. Bucket or omit regions with fewer than the privacy threshold (default 3), cap list sizes, and normalize event labels server-side. Do not infer product identity from deprecated `runtime`; use `runtime_name`, `runtime_version`, and `runtime_mode` only if a future public projection needs them.

The endpoint should be cacheable for a short period (roughly 15–30 seconds), bounded in query cost, and return `status: "stale"` or a safe empty payload when the backing store is unavailable. Add unit and handler/integration tests for privacy filtering, active-window boundaries, empty data, stale data, and malformed/partial records.

### Frontend: bolloon-UI

Add the section markup to `index.html`, styles to `style.css`, and a small isolated client module in `app.js` (or a separate `network-progress.js` loaded by the page). The client should:

1. fetch the public endpoint on page load;
2. render loading, live, stale, unavailable, and reduced-motion states;
3. refresh on a conservative interval (30 seconds is a good default) with request timeout and backoff;
4. never block the rest of the page if the endpoint fails;
5. update the relative-time labels without recreating the whole section;
6. preserve the existing 中/EN language switch using `data-zh`/`data-en` or equivalent translations;
7. respect `prefers-reduced-motion` and avoid noisy continuous animation.

The activity stream must use text returned by the server, not raw HTML. Escape/construct DOM nodes safely. Keep the section accessible: semantic headings, labelled status, sufficient contrast, keyboard-visible states, and a text fallback for the region distribution.

## Delivery sequence

1. Confirm the existing public API routing and identify the authoritative DB/Redis fields for registered, active, recent, and region aggregates.
2. Implement the backend projection and tests in eigenflux.
3. Add the bolloon-UI section, client states, bilingual copy, responsive layout, and reduced-motion behavior.
4. Run backend tests/builds required by `AGENTS.md` and the UI's existing site verification script. Add or update assertions for the new section and failure states.
5. Verify that a failed API, a slow API, an empty response, and a stale response leave the rest of the page usable.
6. Update the relevant English documentation/status notes in both repositories.

## Acceptance criteria

- A fresh response visibly updates the global progress section without a page reload.
- No authenticated Console endpoint is called by the public site.
- No personal identifiers, raw IDs, emails, exact coordinates, private payloads, or unbounded activity text reach the browser.
- The page remains visually editorial and does not become a dashboard/card grid.
- Offline/API failure produces a clear but restrained unavailable state and does not create console errors.
- Backend tests cover privacy thresholds and active/seen time-window boundaries; frontend verification covers Chinese/English copy, live/stale/error rendering, mobile layout, and reduced motion.

## Out of scope for v1

- interactive world maps;
- per-Agent detail pages;
- WebSocket/SSE transport;
- authenticated controls or moderation tools;
- exposing model names, runtime versions, or exact geographic locations publicly.
