# 接好料 ReMat — project guide for Claude Code

Live site: https://remat.tw · Repo: `vireatw/remat` · Owner: Danny (GitHub `vireatw`)

A marketplace for leftover construction materials in Taiwan. Sites with surplus material post an **出料** listing, and people who need a small amount post a **求料** listing. They contact each other by in-app chat or phone and arrange pickup (**接料**). The platform never handles payment or transport.

## How to talk to Danny
- Reply in **Traditional Chinese (Taiwan)** unless he writes in English. Keep answers short and concrete.
- He is not a programmer and often works from an **iPad**. Give tap-by-tap steps for anything he has to do outside the code, such as the Firebase console, GitHub settings or Porkbun.
- After every push, tell him what changed and to open `https://remat.tw/?v=<new number>`. GitHub Pages caches files for about 10 minutes, and the query string bypasses that.
- He cares a lot about **alignment and visual polish**. Check spacing, edges and baselines before calling a UI change done.

## Files
| File | What it is |
| --- | --- |
| `index.html` | The whole app: HTML, CSS and vanilla JS in one file. No build step and no framework. |
| `backend.js` | ES module that loads the Firebase SDK (pinned to `10.12.2` from gstatic) and exposes `window.RematBackend`: a Firestore-like `db` (`doc()`, `collection()`, `where/orderBy/limit/startAfter`, `get/set(d, {merge})/update/delete/add`, `onSnapshot`), `arrayUnion`/`arrayRemove`, plus auth helpers. `update()` flattens nested objects into dotted paths so map fields merge instead of being replaced. Firestore uses a persistent local cache (IndexedDB). |
| `sw.js` | Service worker. Network-first for the site's own files (online users always get the latest version), cache only as an offline fallback. Firebase SDK files from gstatic are cache-first because their URLs are versioned. Bump `CACHE` only if the cached shell list changes. |
| `og.png` | 1200×630 share preview for LINE/Facebook. Generated from HTML with Playwright using the header logo; `ReMat` aligned to `接好料` the same way as the header. |
| `robots.txt`, `sitemap.xml` | Search engine basics. |
| `config.js` | Firebase web config for project `remat-8e08c`. The key is public by design, so **keep it**. Security comes from `firestore.rules`. |
| `firestore.rules` | Firestore security rules. **Changing this file does nothing by itself.** Danny must paste it into Firebase console → Firestore Database → Rules → Publish. Always remind him. |
| `manifest.json`, `icon-*.png`, `apple-touch-icon.png`, `favicon.svg` | PWA / home-screen icons. |
| `CNAME` | Contains `remat.tw`. **Never delete**: it is what connects the custom domain. |

## Hosting and infrastructure
- **GitHub Pages:** deploys from branch `main`, folder `/ (root)`. Custom domain `remat.tw`, Enforce HTTPS on.
- **DNS (Porkbun):** an `ALIAS` record from `remat.tw` to `vireatw.github.io`, and a `CNAME` record from `www` to `vireatw.github.io`.
- **Firebase project `remat-8e08c`, Spark (free) plan:**
  - Auth: Email/Password and Google. Authorized domains are `remat.tw` and `www.remat.tw`.
  - Firestore: Standard edition, `(default)` database, location `asia-east1`.
  - Free quota is about 50k reads and 20k writes per day. Keep queries bounded: the feed loads 60 listings live (`PAGE`) and older ones via 載入更多 (`startAfter(createdAt)`); 我的 uses its own `where(ownerId)` query (limit 100); favorites and `#l=` links fetch single docs by id into `S.extra`. Always look listings up with `getL(id)`, not `S.listings.find`.
  - No Cloud Functions and no Storage. Both would need the Blaze plan, so ask Danny before adding anything that does.

## Data model (Firestore)
- `listings/{id}`:
  - `kind`: `offer`|`want`
  - `cat`: `tile`|`wood`|`steel`|`cement`|`paint`|`bath`|`door`|`mep`|`tool`|`other`
  - `title`, `qty` (number), `unit`, `spec`, `desc`
  - `priceMode`: `free`|`lot`|`unit`|`ask`, plus `price`
  - `county`, `area`, `deadline` (YYYY-MM-DD), `pickup[]`
  - `contactName`, `phone`, `line`
  - `photoCount`, `thumb` (JPEG data URL, under about 26 KB)
  - `ownerId`, `status`: `open`|`hold`|`done`
  - `createdAt`, `updatedAt` (ms)
- `photos/{listingId}-{i}`: `{img, listingId, ownerId}`. Full-size photos are compressed JPEG data URLs under about 200 KB, at most 4 per listing.
- `users/{uid}`: the private contact profile (`name, phone, line, county, area`) plus `favs` (array of listing ids, stored oldest→newest, max 300; the app shows them newest first). Profile saves use `set(..., {merge:true})`; favorites change one id at a time with `arrayUnion`/`arrayRemove`, so writes never overwrite each other. Logged-out favorites live in localStorage `jieliao.favs` (guest only); on login they are merged into the account and the local list is cleared. On logout, name/phone/line are cleared locally (location is kept).
- `admins/{uid}`: if this doc exists, the user is an admin. Admins are added by hand in the console only.
- `chats/{listingId}~{buyerUid}`: `{listingId, title, cat, sellerId, buyerId, members:[sellerId,buyerId], sellerName, buyerName, lastText, lastAt, lastFrom, readAt:{uid:ms}}`
- `chats/{tid}/msgs/{id}`: `{from, text (≤500), at}`

If you change any field, update `firestore.rules` to match and tell Danny to republish the rules. The rules whitelist every field (`keys().hasOnly`), cap string sizes, require `createdAt` within ±10 min of server time on create and unchanged on update, only allow photos under a listing you own (so the app writes the listing **before** its photos), and only let each chat member change their own `readAt`/last message. Messages and `lastAt` must be within ±10 min of server time.

**Testing rules:** install `firebase-tools`, `@firebase/rules-unit-testing` and `firebase@10.12.2` in a scratch folder (`npm i --legacy-peer-deps`), run the Firestore + Auth emulators, and test both the rules directly and the real site against them (route the gstatic SDK URLs to a local esbuild bundle of `firebase/app|firestore|auth`, and patch `backend.js` with `connectFirestoreEmulator`/`connectAuthEmulator`). Block service workers in test contexts unless testing offline.

**Deploy order when rules and site both change:** push the site first, wait ~10 min for GitHub Pages caches, then publish the rules, so old cached pages aren't blocked by the new rules.

## Product rules
- **Never allow or show examples of 剩餘土石方 (soil) or 營建廢棄物 (construction waste).** Both must be handled by licensed operators under Taiwanese law. The 關於 page says so.
- The platform does not handle payments. Safety copy should tell people to inspect goods on site before paying and never to transfer money first.
- Chats must stay private to the buyer and seller. This is enforced in the rules, not only in the UI.
- UI copy is in Traditional Chinese (Taiwan), using site terms: 出料, 求料, 接料, 清場, 刊登.

## Design system
- **Colors:**
  - `--hazard` `#FFC21A` (safety yellow; header background, raised 刊登 button)
  - `--ink` `#1B1C1E`
  - `--paper` `#EFEEE8` (app background)
  - `--card` `#FFFFFF`
  - `--line` `#D9D7CE`
  - Status colors: go `#1E7F47`, hold `#2C64C4`, warn `#D4470E`
- **Fonts:** body text uses the device's built-in Chinese font (PingFang TC on Apple, Microsoft JhengHei on Windows, Noto Sans CJK on Android) so nothing heavy downloads. Barlow Condensed (Google Fonts) for numbers. The header wordmark is **not text**: it is an inline SVG (`.logo-type`) of outlined glyphs (Noto Sans TC 900 for 接好料, Barlow Condensed 800 for ReMat, Noto Sans TC 400 for the subtitle), because browsers place font glyphs at different heights (iPhone Safari drew 接好料 about 2pt lower than Chrome). To change it, regenerate the paths with fontTools from the Google Fonts `text=` subsets and re-measure.
- **Logo (B6 "材料堆疊"):** two yellow loop arrows around a pile of three white blocks, on a dark rounded square. The inline SVG is in the header. Keep the blocks optically centered at `y=37.5` and `y=49.5`.
- **Header:** yellow. Icon 44px with the SVG wordmark exactly 44px tall: `接好料` (22px) + 8px gap + `ReMat` scaled so its capitals are exactly as tall as `接好料` ink (tops at y≈3.3, bottoms at y≈24.3), then `工地剩料，就近接手` (13.5px) evenly spread so its ink spans the same left and right edges (y≈31–43.3).
- **Layout breakpoints:**
  - **Phone (<768px):** one column. Bottom nav in this order: **找料 · 訊息 · 刊登 (raised yellow, center) · 關於 · 我的**.
  - **≥768px (iPad):** nav moves into the header (`.topnav`), listings become a card grid, and sheets become centered modals.
  - **≥1100px (desktop):** left filter sidebar, 3-column grid, two-column listing detail.
- **Spacing:** 16px side gutter everywhere on mobile, so left edges line up from the header down to the bottom nav. On ≥768px, 我的/訊息/關於 align with the header's left edge and forms are capped at 720px.
- **Tap targets:** at least 40px (chips, filters, small buttons) and 44px for icon buttons; the card heart is 36px with a 44px hit area. People use this outdoors, sometimes with gloves.
- **Text colors:** `--muted` `#5E6166`, `--warn-text` `#B33A08` for orange-red text (keep `--warn` for fills). Keep text contrast ≥ 4.5:1.
- **URLs:** `#l=<listingId>` opens a listing (set while the detail sheet is open, used by the 分享 button); `#post` opens the post form (home-screen shortcut).
- **Sheets:** `openSheet`/`closeSheet` move focus into the sheet, make everything behind it `inert`, and restore focus on close. Use them for any new sheet.

## Working on the code
- Keep it dependency-free: no bundler, no npm packages in the shipped site.
- Before pushing, at minimum:
  1. Extract the inline `<script>` and run `node --check`.
  2. Load the page locally (`python3 -m http.server`) at 400px, 1024px and 1440px widths.
- `window.RematBackend` can be mocked with an in-memory store for local testing. The real Firebase needs the live domain or `localhost`.
- For small fixes, commit to `main`. For bigger or risky changes, use a branch and let Danny review before merging.
- Write commit messages in English and describe the change briefly in Chinese when you report back to Danny.

## Known gotchas
- **iOS home-screen (standalone) mode:** Google sign-in popups are unreliable, so the login sheet hides the Google button when `navigator.standalone` is true and shows a hint to use Email.
- **Firebase Dynamic Links shutdown notice** in the console: not relevant to this app.
- **GitHub "secret scanning" alert for the Firebase API key:** expected and harmless. The key may later be restricted to `remat.tw` in Google Cloud Console.
- **iPad auto-capitalization:** when Danny types domains or IDs (e.g. `Remat.tw`), check that they stayed lowercase.
