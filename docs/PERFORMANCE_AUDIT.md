# SF_V1.2 performance audit and optimizations

## What was found in the source

This is a source-code audit, not a live CPU profile. The archive does not include production traces, browser performance recordings, Vercel function metrics, or Neon query statistics, so the findings below identify concrete work in the code rather than asserting a measured percentage of CPU usage.

### High-impact browser work

- `components/ui/Stats.tsx`: animated counters previously used React state on every `requestAnimationFrame`, causing every animated counter to re-render at roughly display refresh rate. The counter now writes the changing text directly to its span; React only renders the component when its inputs change.
- `components/home/NewsRail.tsx`: the rail previously read layout geometry inside its animation loop and kept requesting frames while held/hovered. It now measures loop width only when the track resizes, uses the cached width during animation, pauses when hovered/focused/out of view, and does not run the loop for reduced-motion users.
- `components/home/MissionVisionValues.tsx`: the scroll animation previously recalculated computed style and element height in each scroll animation frame and set React state each frame. Geometry is now cached on mount/resize/ResizeObserver; the scroll loop reads the wrapper position and only calls React state when the active step changes.

### Repeated network and render work

- `components/containers/SiteProvider.tsx`: navigation was requested again on every pathname change and on focus/visibility. It now refreshes at most once per minute and does not re-fetch on every client-side route.
- `lib/site.ts`: metadata, root layout and page rendering can request the same public site snapshot during one navigation. The complete public snapshot is now cached for 60 seconds and tagged for invalidation by CMS updates (`site-content`). This reduces repeated CMS, menu and collection database reads while preserving revalidation after edits.
- `app/api/site` and `app/api/navigation`: public responses no longer advertise `private, no-store` where there is no user-specific payload; they permit a short shared cache window.

### Database dashboard and visitor tracking

- `app/api/admin/dashboard/route.ts`: date filters previously applied a timezone conversion to `created_at` in `WHERE`, which can prevent a normal timestamp index from being used. Filters now compare raw timestamp ranges and aggregate each series once for the selected period. Migration `0019` adds supporting indexes.
- `components/containers/Reveal.tsx`: reveal transitions remain one-time, but decorative SVG animations now pause when their wrapper leaves the viewport. This avoids keeping off-screen illustrations on an endless animation timeline.
- `components/home/Hero.tsx`: autoplay and scroll-parallax listeners are active only while the hero is in view.
- `components/ui/NavBar.tsx` and `BackToTop.tsx`: scroll handlers update React state only when their visible/stuck threshold changes.
- `components/home/LocationMaps.tsx`: ResizeObserver updates and Leaflet invalidations are ignored when map dimensions are unchanged. During map pan/zoom, branch-pin coordinates are updated directly in the pin layer once per animation frame instead of forcing the full React map component (district geometry, list and cards) to re-render for every Leaflet event.
- `components/ui/VisitorTracker.tsx`: internal admin navigation is no longer tracked as public traffic, and a short session guard suppresses duplicate Strict Mode effect writes.
- Visitor analytics still intentionally write a page event for public SPA navigation. If production traffic is high, consider sampling/aggregation or a dedicated analytics service; do not remove analytics silently if it is a reporting requirement.

## What still needs production measurement

1. Capture a Chrome Performance recording on the homepage and admin dashboard; compare scripting, layout, paint and long tasks.
2. Review Vercel function duration/invocation volume by route, especially `/api/site`, `/api/navigation`, `/api/visitors`, admin dashboard and CMS collection routes.
3. Review Neon Query Insights for high-call-count SQL, slow queries, connection saturation and repeated `ensureCmsSchema()` checks.
4. Compare CPU and database metrics before/after deployment under the same traffic window. Do not infer actual savings from source changes alone.
5. If CPU remains high, profile map/Leaflet hydration, animated CSS filters/blur, large page JSON payloads, image decoding, and admin table rendering next.

## Operational note

The Google Drive backup mirror runs in GitHub Actions, not in the public Next.js request path. Image Base64 conversion and Drive upload therefore consume CI-runner resources rather than browser or web-server CPU. The Neon trigger journal excludes high-churn analytics, security, and abuse-control tables from per-write updates and includes them in the daily full snapshot.
