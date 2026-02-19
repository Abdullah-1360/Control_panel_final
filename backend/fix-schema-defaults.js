const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Add @default(cuid()) or @default(uuid()) to id fields
// Most models use cuid(), healer models use uuid()

const healerModels = ['wp_sites', 'healer_executions', 'healer_backups', 'healing_patterns', 
                      'manual_diagnosis_sessions', 'healer_metrics', 'healer_alerts', 
                      'healer_audit_logs', 'diagnosis_history', 'diagnosis_cache', 
                      'health_score_history', 'healing_action_logs', 'healing_workflows', 
                      'scheduled_diagnosis'];

// Fix id fields - add @default if missing
const lines = schema.split('\n');
const fixedLines = [];
let currentModel = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track current model
  if (line.match(/^model (\w+) \{/)) {
    currentModel = line.match(/^model (\w+) \{/)[1];
  }
  
  // Fix id field
  if (line.match(/^\s+id\s+String/) && !line.includes('@default')) {
    const isHealerModel = healerModels.some(m => 
      schema.includes(`model ${currentModel}`) && 
      schema.includes(`@@map("${m}")`)
    );
    
    if (isHealerModel) {
      fixedLines.push(line.replace('String', 'String @id @default(uuid())'));
    } else {
      fixedLines.push(line.replace('String', 'String @id @default(cuid())'));
    }
  } else {
    fixedLines.push(line);
  }
}

schema = fixedLines.join('\n');

// Fix createdAt and updatedAt defaults
schema = schema.replace(/createdAt\s+DateTime(?!\s+@default)/g, 'createdAt DateTime @default(now())');
schema = schema.replace(/updatedAt\s+DateTime(?!\s+@default)/g, 'updatedAt DateTime @updatedAt');

fs.writeFileSync(schemaPath, schema);
console.log('Schema defaults fixed!');
