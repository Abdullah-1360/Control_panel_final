#!/bin/bash

# Test diagnosis API to verify diagnosisId is returned
# Replace with your actual application ID and token

APPLICATION_ID="your-application-id-here"
TOKEN="your-access-token-here"

echo "Testing diagnosis API..."
echo "Application ID: $APPLICATION_ID"
echo ""

curl -X POST "http://localhost:3001/api/v1/healer/applications/$APPLICATION_ID/diagnose" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subdomain": null}' \
  | jq '.'

echo ""
echo "Check if 'diagnosisId' field is present in the response above"
