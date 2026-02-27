#!/bin/bash

# Test diagnosis endpoint for Phase 3
# Tests all tech stack plugins

echo "=========================================="
echo "Phase 3: Testing Diagnosis Endpoint"
echo "=========================================="
echo ""

API_URL="http://localhost:3001/api/v1"

# Application IDs from test data
NODEJS_ID="9ceb605a-252e-4ad7-bf09-c50c2a2bb39f"
LARAVEL_ID="70f950bb-440f-4340-9341-8748ede960b7"
PHP_ID="e9684535-550d-4e4b-ae2d-484b50ac5282"
EXPRESS_ID="d6002130-c1c1-4676-b32d-be8b87b0d461"
NEXTJS_ID="4b38ef44-e152-4710-bff8-050ca081c9e3"

# Note: These tests will fail with 401 without authentication
# This is expected - we're testing the endpoint structure

echo "Testing NodeJS Application Diagnosis..."
echo "---------------------------------------"
curl -s -X POST "$API_URL/healer/applications/$NODEJS_ID/diagnose" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Auth required (expected)"
echo ""

echo "Testing Laravel Application Diagnosis..."
echo "----------------------------------------"
curl -s -X POST "$API_URL/healer/applications/$LARAVEL_ID/diagnose" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Auth required (expected)"
echo ""

echo "Testing PHP Application Diagnosis..."
echo "------------------------------------"
curl -s -X POST "$API_URL/healer/applications/$PHP_ID/diagnose" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Auth required (expected)"
echo ""

echo "Testing Express Application Diagnosis..."
echo "----------------------------------------"
curl -s -X POST "$API_URL/healer/applications/$EXPRESS_ID/diagnose" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Auth required (expected)"
echo ""

echo "Testing NextJS Application Diagnosis..."
echo "---------------------------------------"
curl -s -X POST "$API_URL/healer/applications/$NEXTJS_ID/diagnose" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "Auth required (expected)"
echo ""

echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo ""
echo "Note: 401 errors are expected without authentication."
echo "To test with authentication, use the frontend or get a JWT token."
echo ""
echo "Next: Check the frontend to see if applications are visible:"
echo "http://localhost:3000/healer"
