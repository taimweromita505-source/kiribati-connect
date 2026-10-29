# Kiribati Connect — standalone Cloudflare app

Live: https://kiribati-connect.taimweromita505.workers.dev/

Kiribati Connect brings community notices, local opportunities, and island information into one lightweight mobile-friendly app. The working pilot includes a shared feed, native accounts, and an admin approval queue. See [NEXT_STEPS.md](NEXT_STEPS.md) for the pilot plan and development priorities.

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

The optional daily trigger in the Wrangler configuration removes expired sessions and rate-limit entries when deploying through Wrangler. Expiry is enforced on every request regardless of cleanup. The initial API deployment did not enable that optional trigger.

## Validation

Local tests passed for member registration, privilege restrictions, submit/approve/publication, session termination, cross-origin rejection, ignored legacy identity headers, and password changes revoking old sessions. Live checks passed for public browsing, the migrated feed, native owner login, administrator access, rejected spoofed authentication headers, and logout. Visual browser automation was unavailable; the design is carried over from the previously reviewed pilot.
