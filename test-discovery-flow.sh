#!/bin/bash

# Test Discovery Flow
# This script tests the complete discovery queue system

echo "=== Testing Discovery Queue System ==="
echo ""

# Get auth token (replace with your actual credentials)
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsmanager.local","password":"Admin@123456"}' \
  | jq -r '.accessToken')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi
echo "✅ Got auth token"
echo ""

# Get list of servers
echo "2. Getting server list..."
SERVERS=$(curl -s -X GET http://localhost:3001/api/v1/servers \
  -H "Authorization: Bearer $TOKEN")

SERVER_ID=$(echo $SERVERS | jq -r '.data[0].id')
SERVER_NAME=$(echo $SERVERS | jq -r '.data[0].name')

if [ -z "$SERVER_ID" ] || [ "$SERVER_ID" == "null" ]; then
  echo "❌ No servers found"
  exit 1
fi
echo "✅ Found server: $SERVER_NAME ($SERVER_ID)"
echo ""

# Trigger discovery
echo "3. Triggering discovery for server $SERVER_NAME..."
DISCOVERY_RESULT=$(curl -s -X POST http://localhost:3001/api/v1/healer/applications/discover-queued \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"serverId\":\"$SERVER_ID\"}")

JOB_ID=$(echo $DISCOVERY_RESULT | jq -r '.jobId')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" == "null" ]; then
  echo "❌ Failed to trigger discovery"
  echo "Response: $DISCOVERY_RESULT"
  exit 1
fi
echo "✅ Discovery job started: $JOB_ID"
echo ""

# Monitor progress
echo "4. Monitoring discovery progress..."
for i in {1..30}; do
  PROGRESS=$(curl -s -X GET "http://localhost:3001/api/v1/healer/applications/discovery/$JOB_ID/progress" \
    -H "Authorization: Bearer $TOKEN")
  
  STATUS=$(echo $PROGRESS | jq -r '.status')
  PERCENT=$(echo $PROGRESS | jq -r '.progress')
  STEP=$(echo $PROGRESS | jq -r '.currentStep')
  APPS_FOUND=$(echo $PROGRESS | jq -r '.applicationsFound')
  
  echo "[$i/30] Status: $STATUS | Progress: $PERCENT% | Step: $STEP | Apps: $APPS_FOUND"
  
  if [ "$STATUS" == "COMPLETED" ] || [ "$STATUS" == "FAILED" ]; then
    break
  fi
  
  sleep 2
done
echo ""

# Check queue stats
echo "5. Checking queue statistics..."
STATS=$(curl -s -X GET http://localhost:3001/api/v1/healer/applications/discovery/stats \
  -H "Authorization: Bearer $TOKEN")

echo "Queue Stats:"
echo $STATS | jq '.'
echo ""

# Get discovered applications
echo "6. Getting discovered applications..."
APPS=$(curl -s -X GET "http://localhost:3001/api/v1/healer/applications?serverId=$SERVER_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

APP_COUNT=$(echo $APPS | jq '.data | length')
echo "✅ Found $APP_COUNT applications"

# Show first 3 apps with tech stacks
echo ""
echo "Sample applications:"
echo $APPS | jq '.data[0:3] | .[] | {domain: .domain, techStack: .techStack, healthScore: .healthScore, status: .status}'

echo ""
echo "=== Discovery Test Complete ==="
