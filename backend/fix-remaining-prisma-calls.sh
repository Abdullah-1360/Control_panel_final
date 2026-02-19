#!/bin/bash

# Fix remaining Prisma model calls
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.diagnosisCache\b/this.prisma.diagnosis_cache/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.integration\b/this.prisma.integrations/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.webhookEvent\b/this.prisma.webhook_events/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.notificationRule\b/this.prisma.notification_rules/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.emailHistory\b/this.prisma.email_history/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.role\b/this.prisma.roles/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.server\b/this.prisma.servers/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.serverMetrics\b/this.prisma.server_metrics/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.serverTestHistory\b/this.prisma.server_test_history/g' {} +

# Fix type imports
find src -type f -name "*.ts" -exec sed -i 's/from "@prisma\/client"/from "@prisma\/client"/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/, Integration / /g' {} +
find src -type f -name "*.ts" -exec sed -i 's/Prisma\.EmailHistoryWhereInput/Prisma.email_historyWhereInput/g' {} +

# Fix relation names in includes
find src -type f -name "*.ts" -exec sed -i 's/include:.*{.*role:/include: { roles:/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/select:.*{.*role:/select: { roles:/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/where:.*{.*role:/where: { roles:/g' {} +

echo "Fixed remaining Prisma model calls!"
