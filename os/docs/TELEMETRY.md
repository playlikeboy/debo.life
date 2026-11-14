# Telemetry

Telemetry is **off by default**. Debo sends nothing about its users or their usage to anyone unless the person running the server turns it on.

## How it is controlled

| Setting | Effect |
| --- | --- |
| nothing set | Off. `config.ts` sets `COPILOTKIT_TELEMETRY_DISABLED=true` before the CopilotKit SDK loads, and removes `CPK_TELEMETRY_ID` from the process environment. |
| `DEBO_TELEMETRY=on` (also `true` or `1`) | On. The only way to turn it on. |
| `DO_NOT_TRACK=1` or `true` | Off, even when `DEBO_TELEMETRY=on`. |

The old settings (`COPILOTKIT_TELEMETRY_DISABLED=false`, `COPILOTKIT_TELEMETRY_SAMPLE_RATE`, `CPK_TELEMETRY_ID`) no longer turn anything on by themselves.

## What opting in sends

The CopilotKit SDK posts two kinds of events to `https://telemetry.copilotkit.ai/ingest`, tagged `accessibility_title: "Debo"`:

- `oss.runtime.instance_created`: the server started its runtime.
- `oss.runtime.copilot_request_created`: a request reached the runtime (a count, not the request).

Package name and version are included. Conversation text, journal content, file contents, keys and user ids are not part of these events. Sampling defaults to every event when opted in; set `COPILOTKIT_TELEMETRY_SAMPLE_RATE` (0 to 1) to lower it. Debo removes `CPK_TELEMETRY_ID` from the environment only while telemetry is off; if you opt in and set it, the SDK attaches that identity header, so leave it unset to stay anonymous.

This is operator-level server telemetry. Debo does not ask individual users, so do not turn it on for a hosted service without telling them in your privacy notice.

## Tests

`tests/telemetry.test.ts` starts fresh processes with `fetch` replaced before the SDK loads. It checks that nothing is sent by default, with or without a leftover CopilotKit identity or project key; that old opt-out-style settings cannot turn it on; that `DEBO_TELEMETRY=on` sends the tagged event with no key in it; and that `DO_NOT_TRACK` still wins. `tests/config.test.ts` checks the opt-in parsing. `tests/threads.test.ts` records every global `fetch` made while exercising conversations and asserts there are none.

Not verified: delivery to the real telemetry endpoint when opted in (tests intercept the request).
