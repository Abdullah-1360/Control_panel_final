#!/bin/bash

# Test All Tech Stacks - Quick Diagnosis Test
# This script runs diagnosis on all 5 test applications

set -e

echo "🔬 Testing All Tech Stacks"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
API_URL="http://localhost:3001/api/v1"

# Test application IDs
declare -A APPS
APPS[NodeJS]="9ceb605a-252e-4ad7-bf09-c50c2a2bb39f"
APPS[Laravel]="70f950bb-440f-4340-9341-8748ede960b7"
APPS[PHP]="e9684535-550d-4e4b-ae2d-484b50ac5282"
APPS[Express]="d6002130-c1c1-4676-b32d-be8b87b0d461"
APPS[NextJS]="4b38ef44-e152-4710-bff8-050ca081c9e3"

# Login
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsmanager.local","password":"Admin@123456"}')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Logged in${NC}"
echo ""

# Function to diagnose and get score
test_tech_stack() {
  local NAME=$1
  local APP_ID=$2
  
  echo -e "${BLUE}Testing $NAME...${NC}"
  
  # Run diagnosis
  DIAG_RESPONSE=$(curl -s -X POST "$API_URL/healer/applications/$APP_ID/diagnose" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json")
  
  # Get health score
  SCORE_RESPONSE=$(curl -s -X GET "$API_URL/healer/applications/$APP_ID/health-score" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  SCORE=$(echo "$SCORE_RESPONSE" | jq -r '.healthScore')
  
  if [ "$SCORE" != "null" ]; then
    if [ "$SCORE" -ge 80 ]; then
      echo -e "  Health Score: ${GREEN}$SCORE${NC} (HEALTHY)"
    elif [ "$SCORE" -ge 50 ]; then
      echo -e "  Health Score: ${YELLOW}$SCORE${NC} (DEGRADED)"
    else
      echo -e "  Health Score: ${RED}$SCORE${NC} (DOWN)"
    fi
  else
    echo -e "  Health Score: ${RED}Failed${NC}"
  fi
  
  echo ""
}

# Test all tech stacks
echo "🧪 Running diagnosis on all tech stacks..."
echo ""

for NAME in "${!APPS[@]}"; do
  test_tech_stack "$NAME" "${APPS[$NAME]}"
done

echo "=========================="
echo -e "${GREEN}✅ All tech stacks tested!${NC}"
echo "=========================="
