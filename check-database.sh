#!/bin/bash

# Database Check Script
# This script helps you check your database status

echo "🔍 Database Status Check"
echo "========================"
echo ""
echo "Since 'supabase db execute' is not available in your CLI version,"
echo "you have two options to check your database:"
echo ""
echo "Option 1: Use Supabase Dashboard (Easiest)"
echo "  1. Go to: https://supabase.com/dashboard"
echo "  2. Select your project"
echo "  3. Navigate to: SQL Editor"
echo "  4. Copy and paste the queries from check-database.sql"
echo ""
echo "Option 2: Use psql (if you have it installed)"
echo "  psql 'postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres'"
echo "  Then run: SELECT COUNT(*) FROM teams;"
echo ""
echo "Quick Check - Testing Edge Function endpoint:"
echo ""

# Check if .env exists
if [ -f .env ]; then
  source .env
  
  if [ -n "$VITE_SUPABASE_URL" ] && [ -n "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "Testing /current-gameweek endpoint..."
    curl -s -X GET "${VITE_SUPABASE_URL}/functions/v1/server/current-gameweek" \
      -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
      -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
      | jq '.' 2>/dev/null || echo "Response received (install jq for formatted output)"
  else
    echo "⚠️  .env file exists but credentials are missing"
  fi
else
  echo "⚠️  .env file not found - create it first with ./setup.sh"
fi

echo ""
echo "See check-database.sql for SQL queries to run in the dashboard."
