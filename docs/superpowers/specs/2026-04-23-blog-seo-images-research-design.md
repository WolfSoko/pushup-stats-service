# Blog SEO + Images + Research-Posts — Design

Date: 2026-04-23
Branch: `blog/seo-images-research-posts`

## Goal

Lift the blog from a pure text surface to a modern, SEO-optimized publication by
adding hero images, per-post reading time, richer structured data, and two new
research-backed article pairs (DE+EN) — including Wim Hof method content with
inline citations to real primary sources.

## Scope

In scope:

1. **Data model:** `BlogPost` gains `heroImage`, `heroImageAlt`,
   `heroImageCredit`, optional `updatedAt`.
2. **Reading time helper:** Pure function that strips HTML, counts words, returns
   minutes (≈ 200 wpm). Tested.
3. **SEO service:** `SeoService.update()` accepts optional image URL and
   produces `og:image`, `og:image:alt`, `twitter:image`, `article:published_time`,
   `article:modified_time`.
4. **Article component:** Renders a 21:9 hero image, reading time, "Aktualisiert
   am" (when present). Emits richer Article JSON-LD with `image`, `author`,
   `publisher.logo`, `dateModified`, `mainEntityOfPage`, `wordCount`.
5. **List component:** Shows small thumbnails per card so the overview doesn't
   look bare.
6. **Images:** All 10 existing posts plus 4 new posts get an Unsplash photo URL
   via `images.unsplash.com/photo-…`. Photographer credit rendered in the
   article footer.
7. **New posts (4 total — 2 DE + 2 EN):**
   - **Wim Hof & Push-Ups** — breath, cold exposure, recovery. Cites Kox et al.
     2014 PNAS, Huberman Lab, Cleveland Clinic, official Wim Hof Method site.
   - **40+ Push-Ups Heart Study** — JAMA Network Open 2019 (Yang et al.),
     contextualized with AHA resistance-training guidance and Harvard's public
     release.
8. **Sitemap:** Parser is compatible with new fields (verified by regex test);
   no changes required beyond verifying.

Out of scope:

- No CMS, no MDX, no image pipeline, no CDN, no AI-generated images, no
  rewriting of existing article bodies (only metadata added).

## Key technical decisions

- **Unsplash hotlinking** is allowed per their license; we hand-pick stable
  `images.unsplash.com/photo-{id}` URLs and include `?auto=format&fit=crop&w=1600&q=80`.
- **Inline external links** use `rel="noopener nofollow ugc"` and `target="_blank"`.
- **Reading time** computed at render time — lives with the component, not in the
  data file. Keeps the data file readable.
- **JSON-LD** follows schema.org Article; publisher logo points at
  `/assets/pushup-logo.png` (existing asset).

## Tests

- `reading-time.spec.ts` — pure function edge cases (empty, HTML, multi-line).
- `seo.service.spec.ts` — new `imageUrl` argument writes `og:image` /
  `twitter:image` / `og:image:alt`; idempotency.
- Existing sitemap tests unchanged (regex still matches).

## PR flow

1. Commit & push branch `blog/seo-images-research-posts`.
2. Open PR.
3. Up to 3 CodeRabbit review cycles: address actionable feedback, commit, push.
4. `gh pr merge --auto --squash`.
