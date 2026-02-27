#!/bin/bash

# Test Diagnosis Endpoint with Authentication
# This script tests the diagnosis endpoint for all 5 test applications

set -e

echo "🔍 Testing Diagnosis Endpoint with Authentication"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL
API_URL="http://localhost:3001/api/v1"

# Test application IDs
NODEJS_ID="9ceb605a-252e-4ad7-bf09-c50c2a2bb39f"
LARAVEL_ID="70f950bb-440f-4340-9341-8748ede960b7"
PHP_ID="e9684535-550d-4e4b-ae2d-484b50ac5282"
EXPRESS_ID="d6002130-c1c1-4676-b32d-be8b87b0d461"
NEXTJS_ID="4b38ef44-e152-4710-bff8-050ca081c9e3"

# Step 1: Login to get token
echo "📝 Step 1: Logging in to get authentication token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@opsmanager.local",
    "password": "Admin@123456"
  }')

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get access token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Successfully logged in${NC}"
echo "Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Function to test diagnosis
test_diagnosis() {
  local APP_ID=$1
  local APP_NAME=$2
  
  echo "🔬 Testing diagnosis for $APP_NAME..."
  echo "Application ID: $APP_ID"
  
  # Run diagnosis
  DIAGNOSIS_RESPONSE=$(curl -s -X POST "$API_URL/healer/applications/$APP_ID/diagnose" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json")
  
  # Check if diagnosis was successful
  if echo "$DIAGNOSIS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Diagnosis completed successfully${NC}"
    
    # Extract key information
    HEALTH_SCORE=$(echo "$DIAGNOSIS_RESPONSE" | jq -r '.data.healthScore')
    HEALTH_STATUS=$(echo "$DIAGNOSIS_RESPONSE" | jq -r '.data.healthStatus')
    CHECKS_COUNT=$(echo "$DIAGNOSIS_RESPONSE" | jq -r '.data.checks | length')
    ISSUES_COUNT=$(echo "$DIAGNOSIS_RESPONSE" | jq -r '.data.issues | length')
    
    echo "  Health Score: $HEALTH_SCORE"
    echo "  Health Status: $HEALTH_STATUS"
    echo "  Checks Performed: $CHECKS_COUNT"
    echo "  Issues Found: $ISSUES_COUNT"
    
    # Show checks summary
    echo "  Checks:"
    echo "$DIAGNOSIS_RESPONSE" | jq -r '.data.checks[] | "    - \(.name): \(.status)"'
    
    # Show issues if any
    if [ "$ISSUES_COUNT" != "0" ]; then
      echo "  Issues:"
      echo "$DIAGNOSIS_RESPONSE" | jq -r '.data.issues[] | "    - [\(.severity)] \(.title)"'
    fi
  else
    echo -e "${RED}❌ Diagnosis failed${NC}"
    echo "Response: $DIAGNOSIS_RESPONSE"
  fi
  
  echo ""
}

# Step 2: Test diagnosis for all applications
echo "📊 Step 2: Testing diagnosis for all applications..."
echo ""

test_diagnosis "$NODEJS_ID" "NodeJS Application"
test_diagnosis "$LARAVEL_ID" "Laravel Application"
test_diagnosis "$PHP_ID" "PHP Generic Application"
test_diagnosis "$EXPRESS_ID" "Express Application"
test_diagnosis "$NEXTJS_ID" "NextJS Application"

# Step 3: Verify diagnostic results in database
echo "🗄️  Step 3: Verifying diagnostic results in database..."
echo ""

# Get diagnostic results for NodeJS app
echo "📋 Recent diagnostic results for NodeJS application:"
DIAGNOSTICS_RESPONSE=$(curl -s -X GET "$API_URL/healer/applications/$NODEJS_ID/diagnostics?limit=1" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$DIAGNOSTICS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Diagnostic results retrieved successfully${NC}"
  echo "$DIAGNOSTICS_RESPONSE" | jq '.data[0] | {
    id: .id,
    healthScore: .healthScore,
    healthStatus: .healthStatus,
    checksPerformed: .checksPerformed,
    issuesFound: .issuesFound,
    createdAt: .createdAt
  }'
else
  echo -e "${RED}❌ Failed to retrieve diagnostic results${NC}"
  echo "Response: $DIAGNOSTICS_RESPONSE"
fi

echo ""

# Step 4: Get health scores
echo "💯 Step 4: Getting health scores for all applications..."
echo ""

get_health_score() {
  local APP_ID=$1
  local APP_NAME=$2
  
  SCORE_RESPONSE=$(curl -s -X GET "$API_URL/healer/applications/$APP_ID/health-score" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  if echo "$SCORE_RESPONSE" | jq -e '.healthScore' > /dev/null 2>&1; then
    SCORE=$(echo "$SCORE_RESPONSE" | jq -r '.healthScore')
    echo -e "  $APP_NAME: ${GREEN}$SCORE${NC}"
  else
    echo -e "  $APP_NAME: ${RED}Failed${NC}"
  fi
}

get_health_score "$NODEJS_ID" "NodeJS    "
get_health_score "$LARAVEL_ID" "Laravel   "
get_health_score "$PHP_ID" "PHP Generic"
get_health_score "$EXPRESS_ID" "Express   "
get_health_score "$NEXTJS_ID" "NextJS    "

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Diagnosis testing complete!${NC}"
echo "=================================================="
