# Deploying sydran-maps to your VPS

This guide covers deploying the Next.js app (frontend + API) to a VPS
that's already running other apps. The Fabric mod is a separate JAR
file distributed to players — it doesn't run on the server.

## What you need

- A VPS with SSH access, running Linux (Ubuntu/Debian recommended)
- Node.js 20+ and either `npm` or `bun` installed
- A reverse proxy already running (nginx, Caddy, or Traefik)
- A domain or subdomain pointing to your VPS

## Quick deploy (PM2 + nginx)

```bash
# Clone the repo
git clone https://github.com/doodlyyousuf/SydranMaps.git /var/www/sydran-maps
cd /var/www/sydran-maps

# Install deps
npm install
npx prisma generate
npx prisma db push

# Configure environment
cp .env.example .env
nano .env  # set ADMIN_PIN, DATABASE_URL

# Seed demo data (optional)
node scripts/seed.js

# Build
npm run build

# Start on port 3002 (or any free port)
PORT=3002 pm2 start .next/standalone/server.js --name sydran-maps
pm2 save && pm2 startup

# Configure nginx (see below)
# Get HTTPS
sudo certbot --nginx -d sydran-maps.asifent.com
```

## nginx config

```nginx
server {
    listen 80;
    server_name sydran-maps.asifent.com;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## After deployment

1. Set the admin PIN in `.env` and restart: `pm2 restart sydran-maps`
2. Visit `https://sydran-maps.asifent.com/#/admin` → enter PIN → manage products/orders
3. Players configure the Fabric mod: `/sydran config url https://sydran-maps.asifent.com` + `/sydran config pin <your-pin>`

## Building the Fabric mod

```bash
cd mod/
./gradlew build
# Output: build/libs/sydran-maps-1.0.0.jar
# Distribute to players — they drop it in .minecraft/mods/
```

## Updating

```bash
cd /var/www/sydran-maps
git pull && npm install && npx prisma generate && npm run build
pm2 restart sydran-maps
```

## Backups

```bash
# SQLite DB backup
cp /var/www/sydran-maps/db/custom.db ~/backups/sydran-maps-$(date +%Y%m%d).db

# Cron job (daily at 3am)
echo "0 3 * * * cp /var/www/sydran-maps/db/custom.db /home/\$USER/backups/sydran-maps-\$(date +\%Y\%m\%d).db" | crontab -
```
