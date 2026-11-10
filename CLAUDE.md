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
| `backend.js` | ES module that loads the Firebase SDK (pinned to `10.12.2` from gstatic) and exposes `window.RematBackend`: a Firestore-like `db` (`doc()`, `collection()`, `where/orderBy/limit`, `get/set/update/delete/add`, `onSnapshot`) plus auth helpers. `update()` flattens nested objects into dotted paths so map fields merge instead of being replaced. |
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
  - Free quota is about 50k reads and 20k writes per day. Keep queries bounded (listings use `limit(200)`).
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
- `users/{uid}`: the private contact profile (`name, phone, line, county, area`) plus `favs` (array of listing ids, newest first, max 300). It is written with `set()`, which replaces the whole doc, so always write it via `userDoc()`. Logged-out favorites live in localStorage `jieliao.favs` and merge into the account on login.
- `admins/{uid}`: if this doc exists, the user is an admin. Admins are added by hand in the console only.
- `chats/{listingId}~{buyerUid}`: `{listingId, title, cat, sellerId, buyerId, members:[sellerId,buyerId], sellerName, buyerName, lastText, lastAt, lastFrom, readAt:{uid:ms}}`
- `chats/{tid}/msgs/{id}`: `{from, text (≤500), at}`

If you change any field, update `firestore.rules` to match (`okListing()` validates listings) and tell Danny to republish the rules.

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
- **Fonts:** Noto Sans TC for UI and names; Barlow Condensed for numbers and "ReMat".
- **Logo (B6 "材料堆疊"):** two yellow loop arrows around a pile of three white blocks, on a dark rounded square. The inline SVG is in the header. Keep the blocks optically centered at `y=37.5` and `y=49.5`.
- **Header:** yellow. Icon 44px with the text block exactly 44px tall (`接好料` + `ReMat` on one line, then `工地剩料，就近接手` justified to the same width).
- **Layout breakpoints:**
  - **Phone (<768px):** one column. Bottom nav in this order: **找料 · 訊息 · 刊登 (raised yellow, center) · 關於 · 我的**.
  - **≥768px (iPad):** nav moves into the header (`.topnav`), listings become a card grid, and sheets become centered modals.
  - **≥1100px (desktop):** left filter sidebar, 3-column grid, two-column listing detail.
- **Spacing:** 16px side gutter everywhere on mobile, so left edges line up from the header down to the bottom nav.

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
