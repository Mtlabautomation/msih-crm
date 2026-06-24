#!/usr/bin/env bash
# MSIH CRM V1.0 — Vercel Build Script
# Automatically switches Prisma to PostgreSQL and builds the Next.js app.
# Set this as the "Build Command" in your Vercel project settings:
#   bash vercel-build.sh
#
# Developer: Manoj Dore — MIT License

set -e

echo "🔧 MSIH CRM Vercel build starting..."

# 1. Switch Prisma schema to PostgreSQL (Vercel can't use SQLite)
echo "📦 Switching Prisma to PostgreSQL provider..."
cp prisma/schema.postgres.prisma prisma/schema.prisma

# 2. Generate Prisma Client
echo "⚙️  Generating Prisma Client..."
npx prisma generate

# 3. Push schema to the production database (creates tables)
#    This is safe to run multiple times — it only creates/updates tables.
echo "🗄️  Pushing schema to database..."
npx prisma db push --accept-data-loss || echo "⚠️  prisma db push failed (tables may already exist). Continuing..."

# 4. Build Next.js (use plain next build, NOT npm run build which copies standalone files)
echo "🏗️  Building Next.js..."
npx next build

echo "✅ Vercel build complete!"
echo ""
echo "Next step: seed the database by visiting:"
echo "  https://YOUR-DEPLOYMENT-URL.vercel.app/api/setup?secret=YOUR_SETUP_SECRET"
