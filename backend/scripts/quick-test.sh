#!/bin/bash

# Quick test script for Phase 3
# Tests the plugin system through the API

echo "=========================================="
echo "Phase 3: Quick Plugin System Test"
echo "=========================================="
echo ""

API_URL="http://localhost:3001/api/v1"

# Check if backend is running
echo "1. Checking if backend is running..."
if curl -s "$API_URL/healer/health" > /dev/null 2>&1; then
    echo "✓ Backend is running"
else
    echo "✗ Backend is not running"
    echo "Please start the backend with: npm run start:dev"
    exit 1
fi
echo ""

# Get health status
echo "2. Checking plugin registration..."
HEALTH=$(curl -s "$API_URL/healer/health")
echo "$HEALTH" | jq '.data.universal.supportedTechStacks' 2>/dev/null || echo "$HEALTH"
echo ""

# Check database for servers
echo "3. Checking for test servers..."
echo "You need to create a test server first."
echo ""
echo "To create a test server, use the UI or run:"
echo "POST $API_URL/servers"
echo '{"name": "Test Server", "host": "localhost", "port": 22, "username": "test", "platformType": "LINUX"}'
echo ""

echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Create a test server (if not exists)"
echo "2. Test discovery:"
echo "   curl -X POST $API_URL/healer/applications/discover \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"serverId\": \"your-server-id\", \"paths\": [\"/var/www\"]}'"
echo ""
echo "3. Test diagnosis:"
echo "   curl -X POST $API_URL/healer/applications/{id}/diagnose"
echo ""
echo "4. Test healing:"
echo "   curl -X POST $API_URL/healer/applications/{id}/heal \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"actionName\": \"npm_install\"}'"
echo ""
