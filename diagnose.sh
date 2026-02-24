#!/bin/bash

# FFA Cup Web Application - Diagnostic Script
# This script checks for common configuration issues

echo "🔍 FFA Cup Web Application - System Diagnostics"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Environment Variables
echo "1. Checking Environment Variables..."
if [ -f .env ]; then
  echo -e "${GREEN}✓${NC} .env file exists"
  
  if grep -q "VITE_SUPABASE_URL" .env; then
    SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -n "$SUPABASE_URL" ]; then
      echo -e "${GREEN}✓${NC} VITE_SUPABASE_URL is set: ${SUPABASE_URL}"
    else
      echo -e "${RED}✗${NC} VITE_SUPABASE_URL is empty"
    fi
  else
    echo -e "${RED}✗${NC} VITE_SUPABASE_URL not found in .env"
  fi
  
  if grep -q "VITE_SUPABASE_ANON_KEY" .env; then
    ANON_KEY=$(grep "VITE_SUPABASE_ANON_KEY" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -n "$ANON_KEY" ]; then
      KEY_PREVIEW="${ANON_KEY:0:20}..."
      echo -e "${GREEN}✓${NC} VITE_SUPABASE_ANON_KEY is set: ${KEY_PREVIEW}"
    else
      echo -e "${RED}✗${NC} VITE_SUPABASE_ANON_KEY is empty"
    fi
  else
    echo -e "${RED}✗${NC} VITE_SUPABASE_ANON_KEY not found in .env"
  fi
else
  echo -e "${RED}✗${NC} .env file not found"
  echo -e "${YELLOW}  → Create .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY${NC}"
fi

echo ""

# Check 2: Supabase CLI
echo "2. Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
  echo -e "${GREEN}✓${NC} Supabase CLI is installed"
  
  # Check if logged in
  if supabase projects list &> /dev/null; then
    echo -e "${GREEN}✓${NC} Supabase CLI is logged in"
  else
    echo -e "${YELLOW}⚠${NC} Supabase CLI may not be logged in"
    echo -e "${YELLOW}  → Run: supabase login${NC}"
  fi
  
  # Check if project is linked
  if [ -f supabase/.temp/project-ref ]; then
    PROJECT_REF=$(cat supabase/.temp/project-ref)
    echo -e "${GREEN}✓${NC} Project is linked: ${PROJECT_REF}"
  else
    echo -e "${YELLOW}⚠${NC} Project may not be linked"
    echo -e "${YELLOW}  → Run: supabase link --project-ref YOUR_PROJECT_REF${NC}"
  fi
else
  echo -e "${RED}✗${NC} Supabase CLI is not installed"
  echo -e "${YELLOW}  → Install: npm install -g supabase${NC}"
fi

echo ""

# Check 3: Edge Functions
echo "3. Checking Edge Functions..."
if [ -d "supabase/functions/server" ]; then
  echo -e "${GREEN}✓${NC} Edge Function code exists: supabase/functions/server/"
  
  if [ -f "supabase/functions/server/index.ts" ]; then
    echo -e "${GREEN}✓${NC} Main Edge Function file exists"
  else
    echo -e "${RED}✗${NC} index.ts not found in server function"
  fi
else
  echo -e "${RED}✗${NC} Edge Function directory not found"
fi

echo ""

# Check 4: Database Migrations
echo "4. Checking Database Migrations..."
if [ -d "supabase/migrations" ]; then
  MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)
  echo -e "${GREEN}✓${NC} Migrations directory exists (${MIGRATION_COUNT} migration files)"
  
  # Check for key migrations
  if [ -f "supabase/migrations/20260126_current_season.sql" ]; then
    echo -e "${GREEN}✓${NC} Main schema migration exists"
  fi
  
  if [ -f "supabase/migrations/20260129_seed_placeholders.sql" ]; then
    echo -e "${GREEN}✓${NC} Seed data migration exists"
  fi
else
  echo -e "${RED}✗${NC} Migrations directory not found"
fi

echo ""

# Check 5: Frontend Dependencies
echo "5. Checking Frontend Setup..."
if [ -f "package.json" ]; then
  echo -e "${GREEN}✓${NC} package.json exists"
  
  if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists (dependencies installed)"
  else
    echo -e "${YELLOW}⚠${NC} node_modules not found"
    echo -e "${YELLOW}  → Run: npm install${NC}"
  fi
else
  echo -e "${RED}✗${NC} package.json not found"
fi

echo ""

# Summary
echo "================================================"
echo "Summary:"
echo ""

if [ -f .env ] && grep -q "VITE_SUPABASE_URL" .env && grep -q "VITE_SUPABASE_ANON_KEY" .env; then
  echo -e "${GREEN}✓${NC} Environment variables configured"
else
  echo -e "${RED}✗${NC} Environment variables missing - CRITICAL"
fi

if command -v supabase &> /dev/null; then
  echo -e "${GREEN}✓${NC} Supabase CLI available"
else
  echo -e "${RED}✗${NC} Supabase CLI missing"
fi

if [ -d "supabase/functions/server" ]; then
  echo -e "${GREEN}✓${NC} Edge Functions code present"
else
  echo -e "${RED}✗${NC} Edge Functions code missing"
fi

echo ""
echo "Next Steps:"
echo "1. If .env is missing, create it with your Supabase credentials"
echo "2. Deploy Edge Functions: supabase functions deploy server"
echo "3. Verify database has data (check teams, season_state tables)"
echo "4. Test endpoints in browser console or with curl"
echo ""
echo "See SYSTEMS_CHECK.md for detailed troubleshooting guide"
