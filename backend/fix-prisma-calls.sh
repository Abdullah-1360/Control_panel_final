#!/bin/bash

# Fix all Prisma model calls to use snake_case
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.user\b/this.prisma.users/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.session\b/this.prisma.sessions/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.passwordResetToken\b/this.prisma.password_reset_tokens/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.emailTemplate\b/this.prisma.email_templates/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.wpSite\b/this.prisma.wp_sites/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.healerExecution\b/this.prisma.healer_executions/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.healerBackup\b/this.prisma.healer_backups/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.healingPattern\b/this.prisma.healing_patterns/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.manualDiagnosisSession\b/this.prisma.manual_diagnosis_sessions/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.diagnosisHistory\b/this.prisma.diagnosis_history/g' {} +
find src -type f -name "*.ts" -exec sed -i 's/this\.prisma\.healthScoreHistory\b/this.prisma.health_score_history/g' {} +

echo "Fixed all Prisma model calls!"
