#!/bin/bash

# Backup current schema
cp prisma/schema.prisma prisma/schema.prisma.backup

# Fix relation types - change snake_case to PascalCase
sed -i 's/users\s\+users?/User users?/g' prisma/schema.prisma
sed -i 's/users\s\+users\[\]/User users[]/g' prisma/schema.prisma
sed -i 's/users\s\+users\s/User users /g' prisma/schema.prisma

sed -i 's/roles\s\+roles?/Role roles?/g' prisma/schema.prisma
sed -i 's/roles\s\+roles\[\]/Role roles[]/g' prisma/schema.prisma
sed -i 's/roles\s\+roles\s/Role roles /g' prisma/schema.prisma

sed -i 's/permissions\s\+permissions\[\]/Permission permissions[]/g' prisma/schema.prisma

sed -i 's/sessions\s\+sessions\[\]/Session sessions[]/g' prisma/schema.prisma

sed -i 's/audit_logs\s\+audit_logs\[\]/AuditLog auditLogs[]/g' prisma/schema.prisma

sed -i 's/password_reset_tokens\s\+password_reset_tokens\[\]/PasswordResetToken passwordResetTokens[]/g' prisma/schema.prisma

sed -i 's/servers\s\+servers?/Server servers?/g' prisma/schema.prisma
sed -i 's/servers\s\+servers\[\]/Server servers[]/g' prisma/schema.prisma
sed -i 's/servers\s\+servers\s/Server servers /g' prisma/schema.prisma

sed -i 's/server_metrics\s\+server_metrics\[\]/ServerMetrics serverMetrics[]/g' prisma/schema.prisma

sed -i 's/server_test_history\s\+server_test_history\[\]/ServerTestHistory serverTestHistory[]/g' prisma/schema.prisma

sed -i 's/integrations\s\+integrations\[\]/Integration integrations[]/g' prisma/schema.prisma
sed -i 's/integrations\s\+integrations\s/Integration integrations /g' prisma/schema.prisma

sed -i 's/webhook_events\s\+webhook_events\[\]/WebhookEvent webhookEvents[]/g' prisma/schema.prisma

sed -i 's/wp_sites\s\+wp_sites?/WpSite wpSites?/g' prisma/schema.prisma
sed -i 's/wp_sites\s\+wp_sites\[\]/WpSite wpSites[]/g' prisma/schema.prisma
sed -i 's/wp_sites\s\+wp_sites\s/WpSite wpSites /g' prisma/schema.prisma

sed -i 's/healer_executions\s\+healer_executions?/HealerExecution healerExecutions?/g' prisma/schema.prisma
sed -i 's/healer_executions\s\+healer_executions\[\]/HealerExecution healerExecutions[]/g' prisma/schema.prisma

sed -i 's/healer_backups\s\+healer_backups?/HealerBackup healerBackups?/g' prisma/schema.prisma
sed -i 's/healer_backups\s\+healer_backups\[\]/HealerBackup healerBackups[]/g' prisma/schema.prisma

sed -i 's/healing_patterns\s\+healing_patterns\[\]/HealingPattern healingPatterns[]/g' prisma/schema.prisma

sed -i 's/manual_diagnosis_sessions\s\+manual_diagnosis_sessions\[\]/ManualDiagnosisSession manualDiagnosisSessions[]/g' prisma/schema.prisma

sed -i 's/diagnosis_history\s\+diagnosis_history\[\]/DiagnosisHistory diagnosisHistory[]/g' prisma/schema.prisma

sed -i 's/health_score_history\s\+health_score_history\[\]/HealthScoreHistory healthScoreHistory[]/g' prisma/schema.prisma

sed -i 's/healing_action_logs\s\+healing_action_logs\[\]/HealingActionLog healingActionLogs[]/g' prisma/schema.prisma

sed -i 's/healing_workflows\s\+healing_workflows\[\]/HealingWorkflow healingWorkflows[]/g' prisma/schema.prisma

sed -i 's/scheduled_diagnosis\s\+scheduled_diagnosis?/ScheduledDiagnosis scheduledDiagnosis?/g' prisma/schema.prisma

sed -i 's/email_templates\s\+email_templates\[\]/EmailTemplate emailTemplates[]/g' prisma/schema.prisma

sed -i 's/notification_rules\s\+notification_rules?/NotificationRule notificationRules?/g' prisma/schema.prisma
sed -i 's/notification_rules\s\+notification_rules\[\]/NotificationRule notificationRules[]/g' prisma/schema.prisma

sed -i 's/email_history\s\+email_history\[\]/EmailHistory emailHistory[]/g' prisma/schema.prisma

echo "Schema relations fixed!"
