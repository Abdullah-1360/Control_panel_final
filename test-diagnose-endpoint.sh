#!/bin/bash

# Test the diagnose endpoint
# Replace these with your actual values
APP_ID="0af397b7-3f09-4b76-8a3e-76c0a7bfb5c2"
TOKEN="your-access-token-here"

echo "Testing POST /api/v1/healer/applications/$APP_ID/diagnose"
echo "=================================================="
echo ""

# Test POST request (correct method)
echo "1. Testing POST request (should work):"
curl -X POST "http://localhost:3001/api/v1/healer/applications/$APP_ID/diagnose" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subdomain": null}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' 2>/dev/null || cat

echo ""
echo "=================================================="
echo ""

# Test GET request (should fail with 404)
echo "2. Testing GET request (should fail with 404):"
curl -X GET "http://localhost:3001/api/v1/healer/applications/$APP_ID/diagnose" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' 2>/dev/null || cat

echo ""
echo "=================================================="
echo ""
echo "If POST returns diagnosisId, the backend is working correctly."
echo "The GET 404 error is expected and can be ignored."
