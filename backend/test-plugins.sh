#!/bin/bash

# Test script for Universal Healer Plugin System
# Phase 2.5 - Testing & Verification

echo "=========================================="
echo "Universal Healer Plugin System Test"
echo "Phase 2.5 - Testing & Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL
API_URL="http://localhost:3001/api/v1"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
        echo "Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "1. Testing Health Check Endpoint"
echo "-----------------------------------"
test_endpoint "Health Check" "GET" "/healer/health" "" "200"
echo ""

echo "2. Testing Applications CRUD"
echo "-----------------------------------"
test_endpoint "List Applications" "GET" "/healer/applications" "" "200"
echo ""

echo "3. Testing Plugin System Status"
echo "-----------------------------------"
echo "Checking if plugins are registered..."
curl -s "$API_URL/healer/health" | grep -q "NODEJS" && echo -e "${GREEN}✓${NC} NodeJS plugin registered" || echo -e "${RED}✗${NC} NodeJS plugin not found"
curl -s "$API_URL/healer/health" | grep -q "LARAVEL" && echo -e "${GREEN}✓${NC} Laravel plugin registered" || echo -e "${RED}✗${NC} Laravel plugin not found"
curl -s "$API_URL/healer/health" | grep -q "PHP_GENERIC" && echo -e "${GREEN}✓${NC} PHP Generic plugin registered" || echo -e "${RED}✗${NC} PHP Generic plugin not found"
curl -s "$API_URL/healer/health" | grep -q "NEXTJS" && echo -e "${GREEN}✓${NC} NextJS plugin registered" || echo -e "${RED}✗${NC} NextJS plugin not found"
curl -s "$API_URL/healer/health" | grep -q "EXPRESS" && echo -e "${GREEN}✓${NC} Express plugin registered" || echo -e "${RED}✗${NC} Express plugin not found"
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Test discovery with real server"
    echo "2. Test diagnosis on discovered applications"
    echo "3. Test healing actions"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "Please check the errors above"
    exit 1
fi
