# Next steps

1. Completed: Square Sandbox is connected to the Worker using secrets, matching Australian location and exact notification URL, with PAYMENT_MODE=test. The enabled subscription receives only payment.created and payment.updated.
2. Completed: an actual AUD $1 Square Sandbox checkout simulation, payment re-read, local publication and deployed signed notification test. Duplicate delivery, wrong amounts, ownership, unpaid access and signatures are covered by automated tests. Square does not support Google Pay in Sandbox; verify live wallet eligibility on an eligible device after production activation.
3. Confirm the Australian Square account can accept live online payments and its payout bank details are complete. The owner completes account verification or agreements directly.
4. Before live activation, connect production credentials, approve the live switch, and document refund, dispute, privacy and acceptable-content handling. Do not put sandbox credentials in a live configuration.
5. Pilot with trusted contributors: create a showcase, upload screenshots, add links, publish after payment, edit, complete, archive, delete and restore. Test on low-end Android phones and intermittent connections.
6. Add account email verification/recovery, pagination, shared organisation membership, and R2 media storage as usage grows. Weather and live push remain separate future work.

Each new showcase costs AUD $1; accounts and edits are free. Listings publish after confirmed payment with no admin review. Owner takedown remains available. Delete currently moves a listing into a private recoverable Deleted state.
