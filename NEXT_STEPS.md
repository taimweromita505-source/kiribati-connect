# Next steps

## 1. Run a one-week South Tarawa pilot

- Change the owner's temporary password through **Account**.
- Share the Cloudflare URL with 3–5 trusted people. Browsing is public; each participant can create a member account to submit notices. The previous ChatGPT-site invitations do not create accounts here.
- Ask each participant to submit one real, useful community notice. Confirm the details before approving it.
- Review submissions at least once each day. Add a helpful note when rejecting an incomplete notice.
- Ask participants whether they returned to the feed, which information helped, and what they could not find.

Success for this first pilot: all participants can submit successfully, approval is manageable, and at least three return during the week. Record feedback manually before adding analytics or more features.

## 2. Improve notice management

The next recommended coding task is **edit, withdraw, and expire notices**:

- Let authors correct drafts or resubmit rejected notices.
- Let administrators withdraw an approved notice without deleting its review history.
- Add event dates and expiry so old notices stop appearing as current information.
- Add pagination beyond the current feed, history, and queue limits.
- Test ownership, changes after approval, expiry, and offline freshness.

## 3. Prepare accounts for a wider audience

- Implement verified email and a password recovery flow before broad promotion.
- Add a documented owner recovery process and securely back up the authentication pepper.
- Agree on moderation responsibility, acceptable content, retention, and privacy information.
- Test on low-end Android devices and intermittent mobile connections, including install and offline behavior.

## 4. Replace samples with verified information

- Jobs: recruit an employer contact, with closing dates and an application method.
- Boats: start with one operator and route, showing departure dates, confirmation times, cancellations, and a verification contact.
- Government and weather: use approved official sources with attribution and timestamps.
- Marketplace: establish seller/contact and moderation rules before accepting real listings.

Keep sample labels until each source is connected and verified. Add live push notifications after the underlying information is reliable and the pilot shows which alerts people want.

## 5. Make updates repeatable

- Add GitHub build and test checks.
- Add a reviewed deployment workflow with a scoped Cloudflare token stored in GitHub secrets.
- Track database schema versions before enabling automatic migrations on the already deployed database.
- Keep production database exports, account passwords, sessions, and runtime secrets out of Git.

This document is a plan. It does not create invitations, contact data providers, enable analytics, or schedule tasks.
