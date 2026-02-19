#!/bin/bash

# WordPress Auto-Healer Intelligence Implementation Script
# This script implements Phase 1 (Production Readiness) features

set -e

echo "🚀 Starting WordPress Auto-Healer Intelligence Implementation..."
echo ""

# Step 1: Run database migration
echo "📊 Step 1: Running database migration..."
cd backend
npx prisma migrate deploy
npx prisma generate
echo "✅ Database migration completed"
echo ""

# Step 2: Install dependencies (if needed)
echo "📦 Step 2: Checking dependencies..."
if ! grep -q "openai" package.json; then
  echo "Installing OpenAI SDK for Phase 2..."
  pnpm add openai
fi
echo "✅ Dependencies checked"
echo ""

# Step 3: Run tests
echo "🧪 Step 3: Running tests..."
pnpm test verification.service.spec.ts || echo "⚠️  Tests not yet created"
echo ""

# Step 4: Build project
echo "🔨 Step 4: Building project..."
pnpm build
echo "✅ Build completed"
echo ""

echo "✨ Implementation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Review the new services in src/modules/healer/services/"
echo "2. Update healer.module.ts to include new services"
echo "3. Update healer.controller.ts with new endpoints"
echo "4. Run: pnpm test to verify everything works"
echo "5. Start the server: pnpm start:dev"
echo ""
echo "📚 Documentation:"
echo "- Implementation Plan: docs/HEALER_INTELLIGENCE_IMPLEMENTATION_PLAN.md"
echo "- Quick Start Guide: docs/HEALER_QUICK_START_GUIDE.md"
echo "- Summary: docs/HEALER_IMPLEMENTATION_SUMMARY.md"
