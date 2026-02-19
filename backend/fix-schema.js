const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Map of model names to table names
const modelToTable = {
  'User': 'users',
  'Role': 'roles',
  'Permission': 'permissions',
  'Session': 'sessions',
  'AuditLog': 'audit_logs',
  'PasswordResetToken': 'password_reset_tokens',
  'Settings': 'settings',
  'EmailTemplate': 'email_templates',
  'NotificationRule': 'notification_rules',
  'EmailHistory': 'email_history',
  'Server': 'servers',
  'ServerTestHistory': 'server_test_history',
  'ServerMetrics': 'server_metrics',
  'Integration': 'integrations',
  'WebhookEvent': 'webhook_events',
  'WpSite': 'wp_sites',
  'HealerExecution': 'healer_executions',
  'HealerBackup': 'healer_backups',
  'HealingPattern': 'healing_patterns',
  'ManualDiagnosisSession': 'manual_diagnosis_sessions',
  'HealerMetrics': 'healer_metrics',
  'HealerAlert': 'healer_alerts',
  'HealerAuditLog': 'healer_audit_logs',
  'DiagnosisHistory': 'diagnosis_history',
  'DiagnosisCache': 'diagnosis_cache',
  'HealthScoreHistory': 'health_score_history',
  'HealingActionLog': 'healing_action_logs',
  'HealingWorkflow': 'healing_workflows',
  'ScheduledDiagnosis': 'scheduled_diagnosis'
};

// Replace model names with camelCase and add @@map directives
for (const [modelName, tableName] of Object.entries(modelToTable)) {
  // Find the model definition and add @@map if not present
  const modelRegex = new RegExp(`model ${tableName.replace(/_/g, '_')} \\{`, 'g');
  schema = schema.replace(modelRegex, `model ${modelName} {`);
  
  // Add @@map directive before the closing brace of the model
  const mapDirective = `\n  @@map("${tableName}")`;
  const modelEndRegex = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)(\\n\\})`, 'g');
  schema = schema.replace(modelEndRegex, (match, p1, p2) => {
    if (!p1.includes('@@map')) {
      return p1 + mapDirective + p2;
    }
    return match;
  });
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema fixed!');
