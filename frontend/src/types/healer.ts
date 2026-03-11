// Healer Types

export type TechStack = 
  | 'UNKNOWN'
  | 'WORDPRESS'
  | 'NODEJS'
  | 'PHP_GENERIC'
  | 'LARAVEL'
  | 'NEXTJS'
  | 'EXPRESS'
  | 'DJANGO'
  | 'FLASK'
  | 'RAILS'
  | 'MYSQL'
  | 'POSTGRESQL'
  | 'MONGODB'
  | 'REDIS';

export type DetectionMethod = 'AUTO' | 'MANUAL' | 'HYBRID';

export type HealthStatus = 
  | 'UNKNOWN'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'DOWN'
  | 'MAINTENANCE'
  | 'HEALING';

export type HealingMode = 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type DiagnosisProfile = 'FULL' | 'LIGHT' | 'QUICK' | 'CUSTOM';

export type DiagnosisType = 
  | 'WSOD'
  | 'DB_ERROR'
  | 'MAINTENANCE'
  | 'INTEGRITY'
  | 'PERMISSION'
  | 'CACHE'
  | 'PLUGIN_CONFLICT'
  | 'THEME_CONFLICT'
  | 'MEMORY_EXHAUSTION'
  | 'SYNTAX_ERROR'
  | 'HEALTHY'
  | 'UNKNOWN';

export type HealerTrigger = 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO' | 'SEARCH';

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'ERROR';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Application {
  id: string;
  serverId: string;
  domain: string;
  path: string;
  
  // Tech Stack
  techStack: TechStack;
  techStackVersion?: string;
  detectionMethod: DetectionMethod;
  detectionConfidence: number; // 0.0 to 1.0
  
  // Health
  healthStatus: HealthStatus;
  healthScore?: number; // 0-100
  lastHealthCheck?: string;
  
  // Healing Config
  healingMode: HealingMode;
  isHealerEnabled: boolean;
  maxHealingAttempts: number;
  healingCooldown: number;
  currentHealingAttempts: number;
  lastHealingAttempt?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Relations
  server?: {
    id: string;
    host: string;
  };
}

export interface CheckResult {
  name: string;
  category: string;
  status: CheckStatus;
  severity: RiskLevel;
  message: string;
  details?: Record<string, any>;
  suggestedFix?: string;
  executionTime?: number;
}

export interface DiagnosisHistory {
  id: string;
  siteId: string;
  subdomain?: string;
  domain: string;
  profile: DiagnosisProfile;
  checksRun: string[];
  diagnosisType: DiagnosisType;
  healthScore?: number;
  issuesFound: number;
  criticalIssues: number;
  warningIssues: number;
  diagnosisDetails: {
    profile: DiagnosisProfile;
    checksRun: string[];
    checkResults: CheckResult[];
    diagnosisType: DiagnosisType;
    healthScore: number;
    issuesFound: number;
    criticalIssues: number;
    warningIssues: number;
    duration: number;
    timestamp: string;
  };
  commandOutputs: Record<string, any>;
  duration: number;
  triggeredBy?: string;
  trigger: HealerTrigger;
  createdAt: string;
}

export interface DiagnosisHistoryResponse {
  data: DiagnosisHistory[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SubdomainConfig {
  subdomain: string;
  isMainDomain: boolean;
  isSubdomain: boolean;
  isAddonDomain: boolean;
  isParkedDomain: boolean;
  documentRoot?: string;
  sslEnabled?: boolean;
}

export interface SiteTechStack {
  id: string;
  applicationId: string;
  techStack: TechStack;
  techStackVersion?: string;
  detectionMethod: DetectionMethod;
  detectionConfidence: number;
  detectedAt: string;
  
  // Domain Addon Info
  sslEnabled?: boolean;
  sslIssuer?: string;
  sslExpiryDate?: string;
  dnsRecords?: Record<string, any>;
  emailAccountsCount?: number;
  emailQuotaUsedMB?: number;
  emailQuotaTotalMB?: number;
  
  // Domain Type
  isMainDomain: boolean;
  isSubdomain: boolean;
  isParkedDomain: boolean;
  isAddonDomain: boolean;
  
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
