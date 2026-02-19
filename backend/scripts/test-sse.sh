#!/bin/bash

# SSE Testing Script for OpsManager
# This script helps you test the SSE implementation

echo "==================================="
echo "OpsManager SSE Testing Script"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
EMAIL="${TEST_EMAIL:-admin@example.com}"
PASSWORD="${TEST_PASSWORD:-Admin123!@#}"

echo -e "${YELLOW}Step 1: Login to get JWT token${NC}"
echo "Email: $EMAIL"
echo ""

# Login and extract token
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed. Check your credentials.${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

echo -e "${YELLOW}Step 2: Connect to SSE stream${NC}"
echo "URL: $API_URL/api/v1/events/stream"
echo ""
echo -e "${GREEN}Listening for events... (Press Ctrl+C to stop)${NC}"
echo "-----------------------------------"

# Connect to SSE stream
curl -N -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/v1/events/stream" | while read line; do
  
  # Parse SSE format
  if [[ $line == data:* ]]; then
    # Extract JSON data
    json_data="${line#data: }"
    
    # Pretty print with jq if available
    if command -v jq &> /dev/null; then
      echo "$json_data" | jq -C '.'
    else
      echo "$json_data"
    fi
    
    echo "-----------------------------------"
  fi
done
