# sydran-maps

Minecraft map-art marketplace for DonutSMP. Browse the gallery, place orders, pay in-game, and get maps delivered via `/order`.

## What's included

- **Next.js web app** (`/`) — gallery, cart, checkout, order tracking, delivery queue, admin panel, user accounts with Minecraft IGN verification
- **Backend API** (`/src/app/api/`) — 27 routes covering products, orders (full lifecycle), mod config, duplicate detection, user auth, delivery queue
- **Fabric mod** (`/mod/`) — in-game `/sydran` commands for uploading maps, viewing/claiming orders, highlighting required maps, and delivering

## Quick start

```bash
# Install deps
npm install        # or: bun install

# Set up the database
npx prisma generate
npx prisma db push

# Configure environment
cp .env.example .env
# Edit .env — set ADMIN_PIN to something strong

# Seed demo data (optional)
node scripts/seed.js

# Run dev server
npm run dev
```

Visit `http://localhost:3000` for the gallery. Visit `http://localhost:3000/#/admin` and enter your PIN for the admin panel.

## Project structure

```
sydran-maps/
├── src/                        # Next.js web app
│   ├── app/                    # Pages + API routes
│   │   ├── api/                # 27 API endpoints
│   │   ├── globals.css         # Paper-editorial theme
│   │   ├── layout.tsx          # Root layout (Archivo font, favicon)
│   │   └── page.tsx            # SPA router (hash-based)
│   ├── components/sydran/      # All UI components
│   │   ├── gallery-view.tsx    # Catalog + hero + selection tray
│   │   ├── product-detail.tsx  # Product page + tile breakdown
│   │   ├── cart-view.tsx       # Cart + checkout
│   │   ├── order-detail.tsx    # Order lifecycle tracking
│   │   ├── delivery-queue.tsx  # Staff delivery dashboard
│   │   ├── mod-panel.tsx       # /sydran command UI
│   │   ├── admin-view.tsx      # Product + order management
│   │   ├── signup-view.tsx     # User signup + IGN verification
│   │   └── ...
│   └── lib/                    # Shared utilities
│       ├── auth.ts             # Staff auth (cookie + PIN header)
│       ├── user-auth.ts        # User auth (password + IGN verification)
│       ├── rate-limit.ts       # Brute-force protection
│       ├── pixel-art.ts        # Procedural SVG preview generator
│       └── sydran.ts           # Types + formatters
├── prisma/
│   └── schema.prisma           # Product → MapTile, Order → OrderItem, User, ModConfig
├── scripts/
│   └── seed.ts                 # Demo data seeder
├── mod/                        # Fabric mod (separate Java project)
│   ├── src/main/java/          # Commands, API client, config, hashing
│   ├── src/client/java/        # Map reader, highlighter, upload orchestrator
│   ├── src/main/resources/     # fabric.mod.json, lang files
│   ├── build.gradle            # Gradle + fabric-loom
│   └── README.md               # Mod build + usage instructions
├── public/
│   └── favicon.svg             # End crystal icon
├── DEPLOYMENT.md               # Full VPS deployment guide
└── .env.example                # Environment variable template
```

## Features

### Web app
- **Gallery** with responsive auto-fill grid, category/size/sort filters, selection tray
- **Cart** with quantity controls + `/pay` command copy button
- **Order lifecycle**: awaiting_payment → paid → claimed → delivered
- **User accounts**: signup with Minecraft IGN verification (pay small amount to `doodly_yousuf`)
- **Admin panel** (`/#/admin`): edit/delete products, view all orders
- **Delivery queue** (`/#/delivery`): claim/deliver orders with map breakdown
- **Mod panel** (`/#/mod`): /sydran command equivalents in web UI
- **Stealth auth**: no visible login button — admin access only via direct URL + PIN
- **Brute-force protection**: 5 failed attempts → 15-min lockout (exponential backoff)

### Fabric mod
- `/sydran status` — show current config
- `/sydran setprice <amount>` — set upload price (150k, 1.5m, etc.)
- `/sydran setcategory <name>` — set upload category
- `/sydran setsize <WxH>` — set map dimensions (10x6, 2x2, 1x1)
- `/sydran setduplicate <on|off>` — toggle duplicate detection
- `/sydran add [name]` — collect tiles + upload new product
- `/sydran openorders` — list claimable orders with clickable [Open Order] + [Claim Order] buttons in chat
- `/sydran claim <code> <username>` — claim order + auto-highlight required maps
- `/sydran deliver <code> <username>` — mark delivered + clear highlights
- `/sydran rescan <code>` — re-scan for required maps
- `/sydran clearhighlights` — clear all map highlights

### Backend
- 27 API routes
- Dual auth: browser cookies (web) + `Authorization: SydranPIN <pin>` header (mod)
- SHA-256 duplicate detection (server-side, unbypassable)
- Large-map support: Product → MapTile architecture (1×1 up to 10×6)
- IP-based rate limiting on all login endpoints
- SQLite database (no external DB server needed)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full VPS setup guide (PM2 + nginx + HTTPS).

## License

MIT
