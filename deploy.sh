#!/bin/bash

# Edge Function Deployment Script
# This script helps you deploy the server Edge Function

echo "🚀 Deploying Edge Functions"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if logged in
echo "Step 1: Checking Supabase CLI login status..."
if supabase projects list &> /dev/null; then
  echo -e "${GREEN}✓${NC} Already logged in to Supabase CLI"
else
  echo -e "${YELLOW}⚠${NC} Not logged in. Please run:"
  echo "   supabase login"
  echo ""
  echo "This will open a browser window for authentication."
  read -p "Press Enter after you've logged in, or Ctrl+C to cancel..."
fi

# Step 2: Check if project is linked
echo ""
echo "Step 2: Checking project link..."
if [ -f supabase/.temp/project-ref ]; then
  PROJECT_REF=$(cat supabase/.temp/project-ref)
  echo -e "${GREEN}✓${NC} Project is linked: ${PROJECT_REF}"
else
  echo -e "${YELLOW}⚠${NC} Project may not be linked"
  echo "Linking to project: flcewhvladymqgpjbtvo"
  supabase link --project-ref flcewhvladymqgpjbtvo
fi

# Step 3: Check if service role key is set
echo ""
echo "Step 3: Checking Edge Function secrets..."
SECRETS=$(supabase secrets list 2>/dev/null | grep SUPABASE_SERVICE_ROLE_KEY || echo "")
if [ -n "$SECRETS" ]; then
  echo -e "${GREEN}✓${NC} SUPABASE_SERVICE_ROLE_KEY is set"
else
  echo -e "${YELLOW}⚠${NC} SUPABASE_SERVICE_ROLE_KEY not found"
  echo ""
  echo "You need to set the service role key:"
  echo "  1. Go to: Supabase Dashboard → Settings → API"
  echo "  2. Copy the 'service_role' key (NOT the anon key)"
  echo "  3. Run: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  echo ""
  read -p "Have you set the service role key? (y/N): " key_set
  if [[ ! $key_set =~ ^[Yy]$ ]]; then
    echo "Please set the secret and run this script again."
    exit 1
  fi
fi

# Step 4: Deploy the function
echo ""
echo "Step 4: Deploying Edge Function..."
echo "Deploying 'server' function..."
echo ""

if supabase functions deploy server; then
  echo ""
  echo -e "${GREEN}✓${NC} Edge Function deployed successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Test the endpoint (see DEPLOY_EDGE_FUNCTIONS.md)"
  echo "2. Verify database has data"
  echo "3. Create .env file if not done"
  echo "4. Start dev server: npm run dev"
else
  echo ""
  echo -e "${RED}✗${NC} Deployment failed"
  echo ""
  echo "Troubleshooting:"
  echo "1. Make sure you're logged in: supabase login"
  echo "2. Check for syntax errors in supabase/functions/server/index.ts"
  echo "3. Verify project is linked: supabase link --project-ref flcewhvladymqgpjbtvo"
  echo "4. Run with debug: supabase functions deploy server --debug"
  exit 1
fi
