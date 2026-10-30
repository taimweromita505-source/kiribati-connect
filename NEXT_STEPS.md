# Next steps — PayPal account restriction

The dedicated live PayPal app, four Worker secret bindings and two-event webhook are connected. Live order creation returned PAYEE_ACCOUNT_RESTRICTED, so PAYMENT_MODE is disabled and no money was charged.

1. Resolve the merchant account restriction directly in PayPal, including any identity/address requests. Contact PayPal if no action is shown.
2. Once PayPal removes the restriction, set PAYMENT_MODE=live and complete one legitimate AUD $1 checkout. Verify captured payment, webhook delivery and automatic publication.
3. Google Pay is not provisioned for the live account; separate onboarding and wallet integration are required.
4. Add email verification and password recovery before widening the pilot.

Accounts and editing remain free. Drafts remain private until verified completed payment; no admin review is required.
