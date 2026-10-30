# Kiribati Connect — standalone Cloudflare hub

Live: https://kiribati-connect.taimweromita505.workers.dev/

Kiribati Connect is a lightweight information and showcase hub for Kiribati. It runs in the owner's Cloudflare account, independently of ChatGPT. Source is maintained in a private GitHub repository.

## Publishing and managing a showcase

Accounts and browsing are free. Each new showcase listing costs **AUD $1**. Save a private draft, add up to four screenshots/photos and four HTTPS web links, preview it, and pay through **PayPal checkout** through the connected live PayPal account. Google Pay is a separate PayPal merchant capability and remains pending eligibility and setup. Only server-confirmed payment publishes a new listing; redirects and client fields never grant publication. No admin approval is required.

**My hub** provides free editing, mark sold/filled/completed, archive, delete, and restore. Delete is recoverable: the record remains privately in Deleted until restored. It is not a permanent purge. Paid listings can be restored and republished without another fee. Site owners can remove inappropriate listings; contributors cannot undo an owner removal.

All five types are supported: Community, Jobs, Boats, Government, Marketplace. Existing published content is grandfathered without a new charge. Pending submissions become private drafts under migration 0005. Expired records stay out of the public feed. An offline device can retain previously loaded content until reconnection.

Government sources require an actual HTTPS .gov.ki link. The source is publisher supplied, not identity verification; payment does not verify a contributor's identity. Legacy source checks remain distinguishable. Boats require operator confirmation, separate departure/destination islands, and a departure time interpreted in the departure island's time zone. Jobs require application contact and closing date. Marketplace listings include seller, contact, price, condition, and availability.

## Screenshots and web links

Uploaded JPEG/PNG/WebP images are resized in the browser to JPEG, at most 350 KB each; original files are limited to 8 MB. The initial small pilot stores up to four images per listing as D1 BLOBs. Image reads enforce listing visibility and ownership; hidden drafts' images are private. R2 migration is a future capacity improvement. Four labelled, public HTTPS web links are supported per listing. A public showcase is available at `/listing/{id}` while the listing is published and unexpired.

## Architecture

- `src/worker.mjs`: routes, embedded static assets, native account boundary.
- `src/auth.mjs`: native accounts, hashed passwords, sessions, password changes and rate limits.
- `src/hub.mjs`: drafts, showcases, links, image uploads, owner lifecycle and owner removals.
- `src/paypal.mjs`: PayPal Orders API, verified notifications, exact AUD $1 checks, seller matching, idempotent capture and publication.
- `src/payments.mjs`: retained Square Sandbox adapter and regression coverage. New checkout requests use the selected PAYMENT_PROVIDER.
- `src/listing-types.mjs`: section-specific validation and island time zones.
- `src/notices.mjs`: historical moderation implementation retained for regression coverage; it is not routed by the production Worker.
- `public/`: the mobile-friendly UI, editor, preview, offline feed and account screens.
- `migrations/`: D1 schema changes.
- `test/`: native authentication, original validation regressions, and the current hub/payment tests.

## PayPal configuration

The selected provider is now `PAYMENT_PROVIDER=paypal`. Live PayPal credentials and the expected seller ID are configured in Cloudflare Worker secrets. The replacement TAIMWE ROMITA business account is connected and `PAYMENT_MODE=live`. Live AUD $1 order creation succeeded. Cloudflare stores `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` and the expected `PAYPAL_MERCHANT_ID` as bindings (keep the client secret in Worker secrets). `PAYMENT_MODE=test` uses PayPal Sandbox; `live` uses PayPal production.

The dedicated live app is **Kiribati Connect**. Register the exact notification URL `https://kiribati-connect.taimweromita505.workers.dev/api/payments/paypal/webhook` for `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`. Its Webhook ID is required for verification. The server verifies notification signatures with PayPal, retrieves the actual order, checks the exact amount, currency, listing, invoice identifier and seller, and publishes only after a completed capture. The order-approved event also captures server-side if the customer never returns. The authenticated return endpoint is `/api/payments/capture`; a return URL alone never authorizes publication.

Apply migration 0006_paypal.sql once. The app retains Square historical records separately; it never treats Square orders as PayPal orders. The original published notice remains grandfathered.

The dedicated live app and two-event webhook are configured under the replacement TAIMWE ROMITA account. No credentials or identity documents are included in source. Identity/address review may still be requested by PayPal; API credentials alone do not establish completed verification. The 30-test suite covers capture, notification verification, seller/amount matching and duplicate handling with mocked PayPal responses. The previous account returned `PAYEE_ACCOUNT_RESTRICTED` and was replaced. The replacement account accepted a live AUD $1 order and redirected to PayPal. PayPal prevented the signed-in receiving account from paying itself (expected); checkout was cancelled without a charge. A completed payment capture and actual notification-delivery test remains outstanding and requires a legitimate separate payer. Google Pay is explicitly not provisioned for this live account.

## Previous Square Sandbox configuration

Square application: **Kiribati Connect** (`sq0idp-VhEShNTuORscy3QdjqYx4A`). The selected sandbox location is `LJC3JV2Z9SXP6`. Application identifiers and location IDs are not credentials.

Store these as **Cloudflare Worker secrets**, never in Git or browser code:

- `SQUARE_ACCESS_TOKEN`: the selected environment's Square access token. A production personal token has broad account access; use a suitably scoped OAuth integration for production where possible.
- `SQUARE_WEBHOOK_SECRET`: the signature key for this application's webhook subscription.

Non-secret bindings:

- `SQUARE_LOCATION_ID`: the corresponding Square location.
- `SQUARE_WEBHOOK_URL`: the exact registered HTTPS notification URL ending `/api/payments/webhook`.
- `PAYMENT_MODE`: `test` for Square Sandbox or `live` for real Square payments. Defaults to disabled.

Subscribe to `payment.created` and `payment.updated`. The Worker verifies Square's HMAC-SHA256 signature over the exact notification URL and raw body, then retrieves the payment from Square in the configured environment. It checks the completed status, exact amount/currency, location, and order mapping before unlocking only the matching listing. Repeated events do not republish edited or completed content. Archived/deleted listings stay hidden even when a payment arrives late. Failed/cancelled payments do not publish. Refunds are managed in Square; automatic refund/dispute handling is not yet included.

The checkout body fixes the amount on the server, enables Google Pay, disables tips/coupons/loyalty, and uses a stable idempotency key. No user card details pass through this app. A single generic reusable payment link must not replace the per-listing checkout mapping.

**Checkout stays disabled until the environment-specific access token, webhook signature key, URL and location are connected.** The previous Square adapter was connected and tested in test mode. The complete suite now has 30 passing tests. A real Square Sandbox checkout simulation completed for AUD $1, the handler retrieved the completed payment from Square, publication succeeded in an isolated local database, and the deployed signed webhook returned HTTP 200. No production test listing was created. Square Sandbox does not support Google Pay/Apple Pay wallet payments; live wallet eligibility still needs checking before live launch. See https://developer.squareup.com/docs/checkout-api/guidelines-and-limitations.

## Development and deployment

Requires Node.js 24 or newer.

```sh
npm ci
npm test
npm run build
```

The build embeds static assets into one Worker. The runtime uses Cloudflare D1 `kiribati-connect-db`, database ID `e554e2a3-f5fc-4952-b129-4b33cd251edd`, Worker `kiribati-connect`.

Migrations 0001–0004 were previously applied directly through the Cloudflare API. Reconcile the migration ledger before using CLI migration automation; do not replay those schemas. Migration 0005 is the showcase/payment schema. It was applied once through the Cloudflare API on 30 October 2026; reconcile it before CLI migration automation. Keep `AUTH_PEPPER` unchanged; replacing it breaks existing password verification. Runtime secrets, account passwords, sessions and database exports must never enter source control.

Native account email verification and automated password recovery are not yet implemented. Change the owner's temporary password through Account. Shared organisation membership, live weather, live push delivery, permanent deletion and payment refunds are future work.

## Island coverage

`public/islands.json` contains all 33 physical islands plus five existing local areas, shared by filters, the editor and server validation. Sources: [Kiribati Meteorological Service](https://www.met.gov.ki/index.php/component/sppagebuilder/page/18), [MCIA](https://www.mcia.gov.ki/island-profiles), and [National Statistics Office](https://nso.gov.ki/kiribati-districts/line-phoenix/).
