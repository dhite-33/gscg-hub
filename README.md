# GSCG Hub

The GSCG marketing hub: plan content, run video projects from footage to approved cut, check quality, approve, schedule and get posts ready for Instagram, LinkedIn and more.

**Live site:** https://dhite-33.github.io/gscg-hub/

## How it works right now
- `index.html` is the whole app. `data.json` is the shared starting data everyone sees. `blob/` holds the photos and graphics.
- This is a team preview with no server. Changes each person makes save in **their own browser**. Use **Export my changes** in the red bar to send them to Dylan; he imports them and folds them into `data.json`.
- Mateo's Seattle cuts play from his Content Suite site.
- `functions/` and `schema.sql` are an unused Cloudflare backend, kept for when the hub moves to the GSCG Brain host.

## Next step
The professor hosts the final version in the GSCG Brain, with a shared database and sign-in.