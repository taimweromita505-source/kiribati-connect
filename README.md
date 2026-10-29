# Kiribati Connect — standalone Cloudflare app

Live: https://kiribati-connect.taimweromita505.workers.dev/

Kiribati Connect brings community notices, local opportunities, and island information into one lightweight mobile-friendly app. The working pilot includes editable community notices and jobs, a shared feed, native accounts, and an admin approval queue. See [NEXT_STEPS.md](NEXT_STEPS.md) for the pilot plan and development priorities.

## Create and manage listings

Sign in and choose **Create a listing**, then select **Community notice** or **Job vacancy**. Community notices take a title, description, island, and optional expiry date. Jobs also require an employer, application contact, and closing date. All 33 islands and the existing local areas are supported.

**My listings** shows your pending, approved, rejected, closed, withdrawn, and expired listings. Edit a listing to update or resubmit it. Editing an approved listing removes it from the public feed until an administrator reviews the new version. **Close listing** ends an active listing; **Withdraw** removes it from circulation. Either can later be edited and submitted for fresh review.

Administrators can approve or reject pending listings and withdraw published listings. Review notes are visible to the author. Server-side ownership and version checks prevent other members editing your listings and prevent a stale review screen approving newer content. Changes and review outcomes are retained in `listing_events` for audit; no audit-history UI is included yet.

Closing and expiry dates include the selected day and end at local midnight: Gilbert/Banaba UTC+12, Phoenix UTC+13, and Line UTC+14. Expired listings are excluded from the public API and filtered from the offline cache on the device's clock. Closed or withdrawn content already cached on an offline device is refreshed when it reconnects.

Hosted directly in your Cloudflare account as Worker `kiribati-connect`, with D1 database `kiribati-connect-db`. Browsing is public. Registration, sign-in, sessions, password changes, and administrator authorization belong to this app and do not use ChatGPT or Sites.

## Owner access

The owner account is `taimweromita505@gmail.com`. Its temporary password is provided separately in `kiribati-connect-admin-login.txt`, outside this source folder. Sign in, open **Account**, and change the password. Keep that file private. Passwords are hashed with a unique salt and a Worker secret pepper; the pepper is not included in this source.

Visitors can register as members from **Sign in / Join**. Registration always grants the member role; entering the owner's email or passing a role field cannot grant administrator privileges. Members can submit notices and view their own review outcomes. Only administrators can approve or reject submissions. Approved notices appear in the public feed.

Email verification and automated password recovery are not implemented. Registration email addresses are login identifiers, not verified identities. A user who forgets a password currently needs an owner-assisted recovery process. Browser sessions expire after seven days. Password changes revoke old sessions.

## Migrated content

One existing approved notice, **Rain**, was copied with its original identifier, text, island, status, and timestamps. Its owner attribution now points to the new owner account. The original hosted copy remains available separately; changes to that copy do not synchronize with Cloudflare. Use the new URL for the pilot.

Jobs, boat schedules, marketplace listings, and weather remain labelled sample content. Live push delivery remains unimplemented. Existing search, island filtering, bookmarks, and offline reading continue to work.

## Source and deployment

### Island coverage

The island filter and submission form include all **33 Kiribati islands**, grouped into Gilbert Islands and Banaba, Phoenix Islands, and Line Islands. Separate local choices are retained for North Tarawa, South Tarawa, Betio, North Tabiteuea (Meang), and South Tabiteuea (Maiaki). The resulting 38 location choices share one catalog in `public/islands.json`; that catalog also drives server validation. Selecting Tarawa or Tabiteuea includes notices tagged with their local areas. Existing notice locations remain valid.

Island names were checked against the [Kiribati Meteorological Service](https://www.met.gov.ki/index.php/component/sppagebuilder/page/18), [Ministry of Culture and Internal Affairs](https://www.mcia.gov.ki/island-profiles), and [National Statistics Office](https://nso.gov.ki/kiribati-districts/line-phoenix/). Adding an island does not create sample notices or establish a live information feed for it.

- `src/worker.mjs`: routing, asset delivery, role boundary.
- `src/auth.mjs`: native login and member registration, secure HTTP-only session cookies, rate limiting, and password changes.
- `src/notices.mjs`: notice validation, ownership, moderation, and publication.
- `public/`: the mobile-friendly app and account screens.
- `migrations/`: database schema.
- `test/auth.test.mjs`: native authentication and approval tests using SQLite.
- `wrangler.jsonc`: Cloudflare account, Worker and database identifiers.

Requires **Node.js 24 or newer**, with npm, and access to the same Cloudflare account for deployment.

```sh
npm ci
npm test
npm run build
```

`npm test` builds the generated asset module first, then runs the SQLite-backed authentication and moderation tests. Build output embeds the small static assets in one ES-module Worker. To update the existing app using the CLI, authenticate Wrangler to the same Cloudflare account, run the build, then `npx wrangler deploy`. Apply future schema changes using versioned D1 migrations. The initial two schema migrations were applied through the Cloudflare API during this deployment; reconcile the migration ledger before applying them again to this existing database.

`AUTH_PEPPER` is already configured as a Worker secret. Preserve it during deployments and in secure backups. Replacing or losing it invalidates password verification for existing users. No API credentials, owner password, or pepper are stored in the source archive.

The optional daily trigger in the Wrangler configuration removes expired sessions and rate-limit entries when deploying through Wrangler. Session and listing expiry are enforced on every request regardless of cleanup. The API deployments did not enable that optional trigger. Migration `0003_editable_listings.sql` was applied directly through the Cloudflare API; like the initial schemas, it must be accounted for before enabling CLI migration automation.

## Validation

Local tests cover member registration, privilege restrictions, submit/approve/publication, sessions, password changes, all island locations, job validation, owner-only editing, stale review rejection, close/withdraw/resubmit, expiry, and review-history retention. The local browser workflow was exercised with a test job through creation, approval, editing, and return to Pending. No test jobs were published to the production feed.
