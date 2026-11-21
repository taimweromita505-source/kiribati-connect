# Kiri assistant integration plan

Saved 30 October 2026 for later implementation. The initial Cloudflare membership assistant was implemented on 31 October 2026. Custom Hugging Face model hosting and the remaining contextual shortcuts are follow-up work.

## Identity

- Working name: **Kiri**. Check local meaning before finalising the name.
- Display name: **Kiri · Connect Assistant**.
- Proposed profile/logo: a simple frigatebird above an ocean wave, in lagoon blue and warm gold. Artwork remains to be created.
- Introduction: “Hi, I’m Kiri. I can help you explore Kiribati Connect or prepare a listing.”
- English first. Use Kiribati words only when reliable; do not claim fluency.

## Access and presentation

- Mobile: a small floating button above bottom navigation, opening a chat sheet that expands to full screen.
- Desktop: a bottom-right floating button opening a side panel.
- Contextual entry points: “Ask Kiri” beside island information and “Help me write” in the listing editor.
- Hide the floating button during checkout and while the listing editor keyboard is open.
- Users open chat themselves. Show one quiet first-visit introduction, “Need a hand? Ask Kiri.” No automatic chat opening or repeated pop-ups.
- Carry the selected island into chat as visible context; allow users to change it.

## Initial capabilities

1. Find listings for the selected island.
2. Explain posting and the AUD $1 per-new-listing payment.
3. Draft listing titles and descriptions for user review.
4. Help navigate Jobs, Boats, Community and Marketplace.

Reference source listings when answering about schedules or announcements. Say when information is missing. Drafting help is free; users review their listing and pay before publication. The assistant cannot bypass payment or publish on a user's behalf.

## First chat screen

**Kiri** — Your guide to Kiribati Connect

“What can I help you with?”

- Find something on my island
- Help me create a listing
- How does Connect work?

Show “AI assistant · Can make mistakes” and a feedback option.

## Model and feedback

- Intended model: `Taimwe/qwen2.5-coder-7b-kiribati-merged` on Hugging Face.
- Keep the app on Cloudflare; evaluate Google Cloud hosting for inference.
- Match the model's training prompt format and test English conversation before release. It currently has no saved chat template.
- Chats do not automatically retrain the model. Any conversation sharing for improvement must be an explicit user choice, with reviewed corrections used in later training.
- Start with limited pilot access, grounded app information and bounded responses before a public rollout.

## Implementation sequence

1. Verify Google Cloud GPU quota, region, credit eligibility and estimated costs; select a dedicated project.
2. Prepare a bounded model-serving pilot with scale-to-zero, maximum instance limits and budget alerts. Alerts alone are not spending caps.
3. Evaluate the model using new, held-out English and Kiribati examples.
4. Add a server-side Cloudflare inference route with protected credentials, request limits and timeouts.
5. Build Kiri's profile artwork, floating controls, chat sheet/panel and contextual actions.
6. Add source references and optional feedback controls, then test mobile accessibility and failure states.

## Account check on 30 October 2026

Google Cloud billing showed AUD $427.04 available promotional credit (100% remaining), expiring 28 December 2026. Billing is paid and active; October costs showed AUD $1.23. Credit scope says certain usage; GPU coverage and quota are not yet confirmed. No model-hosting resources were created during this check.

## Initial implementation — 31 October 2026

Kiri now uses Cloudflare Workers AI temporarily, with a frigatebird/wave SVG profile, floating launch button and responsive chat dialog. Kiri requires its own payment-confirmed membership: AUD $2 per calendar month or AUD $12 per calendar year. Renewal is manual; listing fees do not unlock Kiri. Access expires server-side, and repeat payment notifications do not duplicate membership time. Usage is limited to 30 messages daily and five per minute per member, with a shared service limit.

English-first responses and public-island context are implemented. The app does not store chats or retrain from them. The custom model, reviewed training feedback, contextual Ask Kiri/Help me write buttons and first-visit introduction remain later work.
