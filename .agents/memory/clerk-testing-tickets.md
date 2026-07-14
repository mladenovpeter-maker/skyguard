---
name: Testing Clerk-gated flows without UI sign-up/verification
description: How to get a testing subagent past Clerk sign-up bot-challenges and sign-in email/client-trust verification when e2e testing an authenticated flow.
---

Clerk's hosted sign-up flow triggers a Cloudflare "verify you are human" challenge that a
Playwright-based testing subagent cannot solve, and password sign-in from a fresh browser
context often hits a `client-trust` step demanding an emailed one-time code the subagent
has no inbox access to. Both block e2e testing of anything behind Clerk auth.

**Why:** these are anti-bot/anti-fraud protections on Clerk's own hosted UI, not something
the app config controls, so they can't be disabled from the app side.

**How to apply:** bypass the UI entirely for test account setup, using Clerk's Backend API
with `CLERK_SECRET_KEY` (already available as a repl secret when Clerk is provisioned):
1. Create a pre-verified test user: `POST https://api.clerk.com/v1/users` with
   `{ email_address: [email], password, skip_password_checks: true }` — skips email
   verification, but a *fresh* sign-in with this email+password can still hit `client-trust`.
2. To skip that too, mint a one-time sign-in ticket: `POST https://api.clerk.com/v1/sign_in_tokens`
   with `{ user_id, expires_in_seconds }`. This returns a `token`.
3. Have the tester navigate to the **app's own origin** at
   `/sign-in?__clerk_ticket=<token>` (not the `accounts.dev` URL in the response) — Clerk's
   SDK auto-detects the ticket param and completes sign-in with no password/code prompt.
4. Clean up afterward: `DELETE https://api.clerk.com/v1/users/<user_id>` to remove the test
   account; tickets are single-use/short-lived and need no separate cleanup.
