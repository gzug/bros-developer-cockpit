GOAL: Harden Cockpit submissions before DC bridge execution: path config works, guardrails run, PIN login is throttled.
BRANCH: codex/cockpit-preflight-auth
CHANGES:
- src/lib/dc-config.json -> change allowed rule from `apps/mobile/src/` to a working glob for UI files under `apps/mobile/src/**`; keep forbids explicit enough to reject native, data, env, package/config, migrations, SQL, Android/iOS.
- src/lib/paths.server.ts and src/lib/paths.test.ts -> support directory-style allow entries safely OR prove config uses glob only; add regression for `apps/mobile/src/screens/ProfileScreenV2.tsx` allowed and malformed trailing slash path rejected.
- src/lib/ideas.functions.ts -> run `checkGuardrails` before `createIdea`; throw its message when blocked; keep saved ideas only for safe submissions.
- src/lib/guardrails.test.ts -> align message expectations with current English copy or update copy consistently; tests must pass.
- src/lib/auth.server.ts -> add process-local login throttling keyed by request IP when available, otherwise single fallback bucket. After repeated wrong PIN attempts, reject briefly with a non-enumerating message. Successful login clears the bucket. Do not store PINs or secrets.
- Add tests for the throttle helper if helper extraction is needed.
VALIDATE:
- bun test
- NITRO_PRESET=node-server bun run build
REPORT:
- Commit hash.
- Files changed.
- Validation commands with EXIT.
