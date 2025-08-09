#!/bin/bash

# This script helps set up Convex environment variables for Supabase authentication

echo "Setting up Convex environment variables for Supabase authentication..."

# Get Supabase URL and Anon Key from .env or .env.local
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'")
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ]; then
    SUPABASE_URL=$(grep VITE_SUPABASE_URL .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "Error: Could not find SUPABASE_URL or SUPABASE_ANON_KEY in .env or .env.local"
    echo "Please make sure these are set in your environment files"
    exit 1
fi

echo "Found Supabase configuration:"
echo "  URL: $SUPABASE_URL"
echo "  Anon Key: ${SUPABASE_ANON_KEY:0:20}..."

# Set Convex environment variables
echo ""
echo "Setting Convex environment variables..."

npx convex env set SUPABASE_URL "$SUPABASE_URL"
npx convex env set SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"

# Also set the backend URL if needed
BACKEND_URL="https://jobotic-backend.onrender.com"
npx convex env set BACKEND_URL "$BACKEND_URL"

echo ""
echo "✅ Convex environment variables have been set!"
echo ""
echo "You can verify them with: npx convex env list"