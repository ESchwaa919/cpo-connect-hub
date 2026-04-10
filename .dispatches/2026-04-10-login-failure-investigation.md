# CPO Connect — Login Failure Investigation

**Reported:** 2026-04-10 by Erik
**Severity:** Urgent — affecting all users
**Symptom:** Login is failing for everyone

## Known error

```
POST /request error: Failed to send magic link email: Application not found
```

This is the concrete error. "Application not found" comes from the email provider rejecting the request because the application / project ID it received isn't recognized.

## Most likely causes (in order of probability)

1. **Env var drift** — the email provider's APP_ID or API_KEY was rotated but Render wasn't updated
2. **Provider account change** — project was deleted/disabled on the provider side
3. **Billing** — provider downgraded the account and dropped the application
4. **Expired API key** — some providers rotate keys automatically

Start by looking at:
- What email provider is used for magic links (Resend? Postmark? SendGrid? Loops? something else?)
- What env vars does the magic link sender read?
- What do Render's current env vars look like for those names? (use `render env:list` or check dashboard)
- What does the provider's dashboard say about the application?

## Task

Investigate and fix the login failure. This is affecting ALL users, so it's probably a systemic issue (auth service down, expired credentials, config drift, API endpoint broken, etc.) rather than a per-user problem.

## Investigation steps

1. **Check production logs first** (per feedback_check_logs_first memory)
   - Look at Render logs for any cpo-connect services
   - Look at browser console errors from a recent failed login
   - Look at API response codes (401? 500? 502? 503? network timeout?)

2. **Verify the auth flow is intact**
   - What auth provider are we using? (Cognito? NextAuth? Custom JWT?)
   - Are the relevant env vars set correctly on Render?
   - Has anything been deployed recently that could have broken auth?
   - Check `git log --oneline -20` for any recent auth-related changes

3. **Check external dependencies**
   - If using Cognito: is the user pool reachable? Are tokens expired?
   - If using a database: is the connection working?
   - If using Redis for sessions: is Redis up?
   - If using a third-party service: check their status page

4. **Reproduce locally if possible**
   - Try to log in against the deployed API with a known test account
   - Check the network tab for the failing request
   - Capture the exact error

## Report format

Once you understand the root cause, report:
1. What the actual problem is
2. Why it's happening (root cause, not just the symptom)
3. The proposed fix
4. Whether it needs Erik's approval before you implement it

Do NOT start implementing a fix until you've reported the root cause back.
If the fix is trivial (e.g. env var rotation, restart a service), report it and wait for go-ahead.
If the fix involves code changes, write the plan first, then execute.

## Branch naming

If you end up making code changes, use: `fix/login-failure-YYYY-MM-DD`

## Context

- Production URL: check `render.yaml` or Render dashboard for the live URL
- Recent state: per memory, CPO Connect has been stable with no active items
- Linear tickets: this is urgent and new — no ticket yet, create one with priority Urgent after diagnosis
