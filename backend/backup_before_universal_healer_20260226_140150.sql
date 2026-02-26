--
-- PostgreSQL database dump
--

\restrict 7wWhD2bU9cNWZRAhRrOYWdzBBYVB5YlPgTEvK5kNdU3qlW581dofyWFg2RIDw9c

-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActorType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."ActorType" AS ENUM (
    'USER',
    'SYSTEM',
    'API'
);


ALTER TYPE public."ActorType" OWNER TO opsmanager;

--
-- Name: AlertSeverity; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."AlertSeverity" AS ENUM (
    'INFO',
    'WARNING',
    'ERROR',
    'CRITICAL'
);


ALTER TYPE public."AlertSeverity" OWNER TO opsmanager;

--
-- Name: AlertStatus; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."AlertStatus" AS ENUM (
    'ACTIVE',
    'ACKNOWLEDGED',
    'RESOLVED',
    'IGNORED'
);


ALTER TYPE public."AlertStatus" OWNER TO opsmanager;

--
-- Name: AlertType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."AlertType" AS ENUM (
    'HIGH_FAILURE_RATE',
    'CIRCUIT_BREAKER_OPEN',
    'VERIFICATION_FAILED',
    'PATTERN_DEGRADATION',
    'SLOW_PERFORMANCE',
    'BACKUP_FAILED',
    'SYSTEM_ERROR'
);


ALTER TYPE public."AlertType" OWNER TO opsmanager;

--
-- Name: AuditAction; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."AuditAction" AS ENUM (
    'DIAGNOSE_SITE',
    'APPROVE_HEALING',
    'EXECUTE_HEALING',
    'ROLLBACK_HEALING',
    'RESET_CIRCUIT_BREAKER',
    'MODIFY_SITE_CONFIG',
    'VIEW_EXECUTION',
    'ACKNOWLEDGE_ALERT',
    'RESOLVE_ALERT',
    'EXECUTE_CUSTOM_COMMAND'
);


ALTER TYPE public."AuditAction" OWNER TO opsmanager;

--
-- Name: AuditResourceType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."AuditResourceType" AS ENUM (
    'SITE',
    'EXECUTION',
    'ALERT',
    'PATTERN',
    'BACKUP'
);


ALTER TYPE public."AuditResourceType" OWNER TO opsmanager;

--
-- Name: BackupStatus; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."BackupStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED',
    'EXPIRED'
);


ALTER TYPE public."BackupStatus" OWNER TO opsmanager;

--
-- Name: BackupType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."BackupType" AS ENUM (
    'FILE',
    'DATABASE',
    'FULL'
);


ALTER TYPE public."BackupType" OWNER TO opsmanager;

--
-- Name: CircuitBreakerState; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."CircuitBreakerState" AS ENUM (
    'CLOSED',
    'OPEN',
    'HALF_OPEN'
);


ALTER TYPE public."CircuitBreakerState" OWNER TO opsmanager;

--
-- Name: DeliveryStatus; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."DeliveryStatus" AS ENUM (
    'DELIVERED',
    'OPENED',
    'CLICKED',
    'BOUNCED'
);


ALTER TYPE public."DeliveryStatus" OWNER TO opsmanager;

--
-- Name: DiagnosisProfile; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."DiagnosisProfile" AS ENUM (
    'FULL',
    'LIGHT',
    'QUICK',
    'CUSTOM'
);


ALTER TYPE public."DiagnosisProfile" OWNER TO opsmanager;

--
-- Name: DiagnosisType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."DiagnosisType" AS ENUM (
    'WSOD',
    'DB_ERROR',
    'MAINTENANCE',
    'INTEGRITY',
    'PERMISSION',
    'CACHE',
    'PLUGIN_CONFLICT',
    'THEME_CONFLICT',
    'MEMORY_EXHAUSTION',
    'SYNTAX_ERROR',
    'HEALTHY',
    'UNKNOWN'
);


ALTER TYPE public."DiagnosisType" OWNER TO opsmanager;

--
-- Name: EmailStatus; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."EmailStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);


ALTER TYPE public."EmailStatus" OWNER TO opsmanager;

--
-- Name: HealerStatus; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."HealerStatus" AS ENUM (
    'PENDING',
    'ANALYZING',
    'DIAGNOSED',
    'APPROVED',
    'HEALING',
    'VERIFYING',
    'SUCCESS',
    'FAILED',
    'SKIPPED',
    'ROLLED_BACK'
);


ALTER TYPE public."HealerStatus" OWNER TO opsmanager;

--
-- Name: HealerTrigger; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."HealerTrigger" AS ENUM (
    'MANUAL',
    'SEMI_AUTO',
    'FULL_AUTO',
    'SEARCH'
);


ALTER TYPE public."HealerTrigger" OWNER TO opsmanager;

--
-- Name: HealingMode; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."HealingMode" AS ENUM (
    'MANUAL',
    'SEMI_AUTO',
    'FULL_AUTO'
);


ALTER TYPE public."HealingMode" OWNER TO opsmanager;

--
-- Name: HealthStatus; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."HealthStatus" AS ENUM (
    'UNKNOWN',
    'HEALTHY',
    'DEGRADED',
    'DOWN',
    'MAINTENANCE',
    'HEALING'
);


ALTER TYPE public."HealthStatus" OWNER TO opsmanager;

--
-- Name: MetricPeriodType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."MetricPeriodType" AS ENUM (
    'HOURLY',
    'DAILY',
    'WEEKLY',
    'MONTHLY'
);


ALTER TYPE public."MetricPeriodType" OWNER TO opsmanager;

--
-- Name: NotificationTrigger; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."NotificationTrigger" AS ENUM (
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'USER_ACTIVATED',
    'USER_DEACTIVATED',
    'USER_ROLE_CHANGED',
    'USER_LOCKED',
    'USER_UNLOCKED',
    'USER_LOGIN',
    'USER_LOGOUT',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET_REQUESTED',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'FAILED_LOGIN_ATTEMPT',
    'SESSION_CREATED',
    'SESSION_REVOKED',
    'SETTINGS_CHANGED'
);


ALTER TYPE public."NotificationTrigger" OWNER TO opsmanager;

--
-- Name: ProviderType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."ProviderType" AS ENUM (
    'WHM',
    'CPANEL',
    'PLESK',
    'WHMCS',
    'ANSIBLE',
    'GIT_GITHUB',
    'GIT_GITLAB',
    'GIT_BITBUCKET',
    'CRM_VTIGER',
    'SLACK',
    'DISCORD',
    'TEAMS',
    'SMTP',
    'SMS_AWS_SNS',
    'SMS_TWILIO'
);


ALTER TYPE public."ProviderType" OWNER TO opsmanager;

--
-- Name: RecipientType; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."RecipientType" AS ENUM (
    'SPECIFIC_USER',
    'SPECIFIC_ROLE',
    'AFFECTED_USER',
    'ALL_USERS',
    'CUSTOM_EMAIL',
    'HYBRID'
);


ALTER TYPE public."RecipientType" OWNER TO opsmanager;

--
-- Name: RetryStrategy; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."RetryStrategy" AS ENUM (
    'IMMEDIATE',
    'LINEAR',
    'EXPONENTIAL',
    'FIBONACCI'
);


ALTER TYPE public."RetryStrategy" OWNER TO opsmanager;

--
-- Name: Severity; Type: TYPE; Schema: public; Owner: opsmanager
--

CREATE TYPE public."Severity" AS ENUM (
    'INFO',
    'WARNING',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."Severity" OWNER TO opsmanager;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO opsmanager;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    "actorType" public."ActorType" NOT NULL,
    "actorId" text,
    action text NOT NULL,
    resource text NOT NULL,
    "resourceId" text,
    description text NOT NULL,
    metadata jsonb,
    "ipAddress" text,
    "userAgent" text,
    severity public."Severity" NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO opsmanager;

--
-- Name: diagnosis_cache; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.diagnosis_cache (
    id text NOT NULL,
    "serverId" text NOT NULL,
    "sitePath" text NOT NULL,
    domain text NOT NULL,
    profile public."DiagnosisProfile" NOT NULL,
    result jsonb NOT NULL,
    "healthScore" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "hitCount" integer DEFAULT 0 NOT NULL,
    "lastAccessedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.diagnosis_cache OWNER TO opsmanager;

--
-- Name: diagnosis_history; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.diagnosis_history (
    id text NOT NULL,
    "siteId" text NOT NULL,
    subdomain text,
    domain text NOT NULL,
    profile public."DiagnosisProfile" NOT NULL,
    "checksRun" text[],
    "diagnosisType" public."DiagnosisType" NOT NULL,
    "healthScore" integer,
    "issuesFound" integer DEFAULT 0 NOT NULL,
    "criticalIssues" integer DEFAULT 0 NOT NULL,
    "warningIssues" integer DEFAULT 0 NOT NULL,
    "diagnosisDetails" jsonb NOT NULL,
    "commandOutputs" jsonb NOT NULL,
    duration integer NOT NULL,
    "triggeredBy" text,
    trigger public."HealerTrigger" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.diagnosis_history OWNER TO opsmanager;

--
-- Name: email_history; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.email_history (
    id text NOT NULL,
    "ruleId" text,
    "templateKey" text NOT NULL,
    recipients text[],
    subject text NOT NULL,
    "htmlBody" text NOT NULL,
    "textBody" text NOT NULL,
    variables jsonb NOT NULL,
    status public."EmailStatus" NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    error text,
    "deliveryStatus" public."DeliveryStatus",
    "triggeredBy" text NOT NULL,
    "triggerEvent" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.email_history OWNER TO opsmanager;

--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.email_templates (
    id text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    "htmlBody" text NOT NULL,
    "textBody" text NOT NULL,
    variables text[],
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.email_templates OWNER TO opsmanager;

--
-- Name: healer_alerts; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healer_alerts (
    id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    metadata text,
    "acknowledgedAt" timestamp(3) without time zone,
    "acknowledgedBy" text,
    "alertType" public."AlertType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "executionId" text,
    "resolvedAt" timestamp(3) without time zone,
    "siteId" text,
    severity public."AlertSeverity" NOT NULL,
    status public."AlertStatus" DEFAULT 'ACTIVE'::public."AlertStatus" NOT NULL
);


ALTER TABLE public.healer_alerts OWNER TO opsmanager;

--
-- Name: healer_audit_logs; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healer_audit_logs (
    id text NOT NULL,
    resource text NOT NULL,
    details text NOT NULL,
    changes text,
    success boolean NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    duration integer,
    "errorMessage" text,
    "executionId" text,
    "ipAddress" text,
    "resourceType" public."AuditResourceType" NOT NULL,
    "siteId" text,
    "userAgent" text,
    "userEmail" text,
    "userId" text,
    action public."AuditAction" NOT NULL
);


ALTER TABLE public.healer_audit_logs OWNER TO opsmanager;

--
-- Name: healer_backups; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healer_backups (
    id text NOT NULL,
    "siteId" text NOT NULL,
    "backupType" public."BackupType" NOT NULL,
    "filePath" text NOT NULL,
    "fileSize" integer,
    "backupData" text NOT NULL,
    status public."BackupStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.healer_backups OWNER TO opsmanager;

--
-- Name: healer_executions; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healer_executions (
    id text NOT NULL,
    "siteId" text NOT NULL,
    trigger public."HealerTrigger" NOT NULL,
    "triggeredBy" text,
    "diagnosisType" public."DiagnosisType" NOT NULL,
    "diagnosisDetails" text NOT NULL,
    confidence double precision NOT NULL,
    "logsAnalyzed" text NOT NULL,
    "suggestedAction" text NOT NULL,
    "suggestedCommands" text NOT NULL,
    "actionTaken" text,
    "backupId" text,
    status public."HealerStatus" NOT NULL,
    "errorMessage" text,
    "executionLogs" text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "diagnosedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    "healedAt" timestamp(3) without time zone,
    "verifiedAt" timestamp(3) without time zone,
    "finishedAt" timestamp(3) without time zone,
    duration integer,
    "preHealthScore" integer,
    "postHealthScore" integer,
    "wasSuccessful" boolean DEFAULT false NOT NULL,
    subdomain text,
    "aiAnalysis" text,
    "aiConfidence" double precision,
    "aiModel" text,
    "aiReasoning" text,
    "aiRecommendations" text,
    "aiTokensUsed" integer,
    "attemptNumber" integer DEFAULT 1 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "postHealingMetrics" text,
    "preHealingMetrics" text,
    "previousAttemptId" text,
    "retryAfter" timestamp(3) without time zone,
    "retryReason" text,
    "verificationChecks" text,
    "verificationResults" text,
    "verificationScore" integer
);


ALTER TABLE public.healer_executions OWNER TO opsmanager;

--
-- Name: healer_metrics; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healer_metrics (
    id text NOT NULL,
    "avgDiagnosisTime" integer,
    "avgHealingTime" integer,
    "avgVerificationScore" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dbErrorCount" integer DEFAULT 0 NOT NULL,
    "failedHealings" integer DEFAULT 0 NOT NULL,
    "firstAttemptSuccessRate" double precision,
    "healingSuccessRate" double precision,
    "healthyCount" integer DEFAULT 0 NOT NULL,
    "otherErrorCount" integer DEFAULT 0 NOT NULL,
    "patternSuccessRate" double precision,
    "patternsApplied" integer DEFAULT 0 NOT NULL,
    "patternsLearned" integer DEFAULT 0 NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodType" public."MetricPeriodType" NOT NULL,
    "rolledBackHealings" integer DEFAULT 0 NOT NULL,
    "successfulHealings" integer DEFAULT 0 NOT NULL,
    "syntaxErrorCount" integer DEFAULT 0 NOT NULL,
    "totalDiagnoses" integer DEFAULT 0 NOT NULL,
    "totalHealings" integer DEFAULT 0 NOT NULL,
    "wsodCount" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.healer_metrics OWNER TO opsmanager;

--
-- Name: healing_action_logs; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healing_action_logs (
    id text NOT NULL,
    "executionId" text,
    "siteId" text NOT NULL,
    "actionType" text NOT NULL,
    "actionDetails" jsonb NOT NULL,
    "beforeState" jsonb,
    "afterState" jsonb,
    "backupId" text,
    status public."HealerStatus" NOT NULL,
    "errorMessage" text,
    duration integer,
    "canRollback" boolean DEFAULT false NOT NULL,
    "rolledBackAt" timestamp(3) without time zone,
    "rollbackReason" text,
    "requiresApproval" boolean DEFAULT true NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.healing_action_logs OWNER TO opsmanager;

--
-- Name: healing_patterns; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healing_patterns (
    id text NOT NULL,
    "diagnosisType" public."DiagnosisType" NOT NULL,
    "errorType" text,
    culprit text,
    "errorPattern" text NOT NULL,
    commands text[],
    description text NOT NULL,
    "successCount" integer DEFAULT 0 NOT NULL,
    "failureCount" integer DEFAULT 0 NOT NULL,
    confidence double precision DEFAULT 0.0 NOT NULL,
    "autoApproved" boolean DEFAULT false NOT NULL,
    "requiresBackup" boolean DEFAULT true NOT NULL,
    "createdBy" text,
    "lastSuccessAt" timestamp(3) without time zone,
    "lastFailureAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastUsedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "commandSequence" text[] DEFAULT ARRAY[]::text[],
    verified boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedBy" text
);


ALTER TABLE public.healing_patterns OWNER TO opsmanager;

--
-- Name: healing_workflows; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.healing_workflows (
    id text NOT NULL,
    "siteId" text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    "diagnosisType" public."DiagnosisType" NOT NULL,
    steps jsonb NOT NULL,
    "currentStep" integer DEFAULT 0 NOT NULL,
    status public."HealerStatus" NOT NULL,
    "isPaused" boolean DEFAULT false NOT NULL,
    "pausedAt" timestamp(3) without time zone,
    "pauseReason" text,
    "requiresStepApproval" boolean DEFAULT true NOT NULL,
    "autoResumeAfter" integer,
    "completedSteps" integer DEFAULT 0 NOT NULL,
    "failedSteps" integer DEFAULT 0 NOT NULL,
    "skippedSteps" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.healing_workflows OWNER TO opsmanager;

--
-- Name: health_score_history; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.health_score_history (
    id text NOT NULL,
    "siteId" text NOT NULL,
    score integer NOT NULL,
    profile public."DiagnosisProfile" NOT NULL,
    "availabilityScore" integer NOT NULL,
    "performanceScore" integer NOT NULL,
    "securityScore" integer NOT NULL,
    "integrityScore" integer NOT NULL,
    "maintenanceScore" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.health_score_history OWNER TO opsmanager;

--
-- Name: integrations; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.integrations (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    provider public."ProviderType" NOT NULL,
    "baseUrl" text,
    username text,
    "encryptedConfig" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastSyncAt" timestamp(3) without time zone,
    "healthStatus" public."HealthStatus" DEFAULT 'UNKNOWN'::public."HealthStatus" NOT NULL,
    "lastTestAt" timestamp(3) without time zone,
    "lastTestSuccess" boolean,
    "lastTestMessage" text,
    "lastTestLatency" integer,
    "lastError" text,
    "linkedServerId" text,
    "createdByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.integrations OWNER TO opsmanager;

--
-- Name: manual_diagnosis_sessions; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.manual_diagnosis_sessions (
    id text NOT NULL,
    "siteId" text NOT NULL,
    commands jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    findings jsonb,
    "learnedPatternId" text,
    "startedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public.manual_diagnosis_sessions OWNER TO opsmanager;

--
-- Name: notification_rules; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.notification_rules (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    trigger public."NotificationTrigger" NOT NULL,
    "templateKey" text NOT NULL,
    "recipientType" public."RecipientType" NOT NULL,
    "recipientValue" jsonb NOT NULL,
    conditions jsonb,
    priority integer DEFAULT 5 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.notification_rules OWNER TO opsmanager;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO opsmanager;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    "roleId" text NOT NULL
);


ALTER TABLE public.permissions OWNER TO opsmanager;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO opsmanager;

--
-- Name: scheduled_diagnosis; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.scheduled_diagnosis (
    id text NOT NULL,
    "siteId" text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    profile public."DiagnosisProfile" DEFAULT 'LIGHT'::public."DiagnosisProfile" NOT NULL,
    "intervalMinutes" integer DEFAULT 15 NOT NULL,
    "maintenanceWindowStart" text,
    "maintenanceWindowEnd" text,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    "autoHealEnabled" boolean DEFAULT false NOT NULL,
    "autoHealTypes" text[],
    "alertOnIssues" boolean DEFAULT true NOT NULL,
    "alertChannels" text[],
    "alertThreshold" integer DEFAULT 1 NOT NULL,
    "lastRunAt" timestamp(3) without time zone,
    "nextRunAt" timestamp(3) without time zone,
    "consecutiveFailures" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.scheduled_diagnosis OWNER TO opsmanager;

--
-- Name: server_metrics; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.server_metrics (
    id text NOT NULL,
    "serverId" text NOT NULL,
    "cpuUsagePercent" double precision NOT NULL,
    "cpuCores" integer,
    "loadAverage1m" double precision,
    "loadAverage5m" double precision,
    "loadAverage15m" double precision,
    "memoryTotalMB" integer NOT NULL,
    "memoryUsedMB" integer NOT NULL,
    "memoryFreeMB" integer NOT NULL,
    "memoryAvailableMB" integer,
    "memoryUsagePercent" double precision NOT NULL,
    "swapTotalMB" integer,
    "swapUsedMB" integer,
    "swapUsagePercent" double precision,
    "diskTotalGB" double precision NOT NULL,
    "diskUsedGB" double precision NOT NULL,
    "diskFreeGB" double precision NOT NULL,
    "diskUsagePercent" double precision NOT NULL,
    "diskReadMBps" double precision,
    "diskWriteMBps" double precision,
    "diskIops" integer,
    "networkRxMBps" double precision,
    "networkTxMBps" double precision,
    "networkRxTotalMB" double precision,
    "networkTxTotalMB" double precision,
    uptime integer NOT NULL,
    "processCount" integer,
    "threadCount" integer,
    "detectedOS" text,
    "kernelVersion" text,
    "collectionLatency" integer NOT NULL,
    "collectionSuccess" boolean DEFAULT true NOT NULL,
    "collectionError" text,
    "collectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.server_metrics OWNER TO opsmanager;

--
-- Name: server_test_history; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.server_test_history (
    id text NOT NULL,
    "serverId" text NOT NULL,
    "triggeredByUserId" text NOT NULL,
    success boolean NOT NULL,
    message text NOT NULL,
    latency integer NOT NULL,
    details jsonb NOT NULL,
    "detectedOS" text,
    "detectedUsername" text,
    errors text[],
    warnings text[],
    "testedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.server_test_history OWNER TO opsmanager;

--
-- Name: servers; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.servers (
    id text NOT NULL,
    name text NOT NULL,
    environment character varying(20),
    tags text[],
    notes character varying(1000),
    "platformType" character varying(20) NOT NULL,
    host character varying(255) NOT NULL,
    port integer NOT NULL,
    "connectionProtocol" character varying(20) NOT NULL,
    username character varying(100) NOT NULL,
    "authType" character varying(50) NOT NULL,
    "encryptedPrivateKey" text,
    "encryptedPassphrase" text,
    "encryptedPassword" text,
    "privilegeMode" character varying(20) NOT NULL,
    "sudoMode" character varying(30) NOT NULL,
    "encryptedSudoPassword" text,
    "hostKeyStrategy" character varying(30) NOT NULL,
    "knownHostFingerprints" jsonb,
    "lastTestStatus" character varying(20),
    "lastTestAt" timestamp(3) without time zone,
    "lastTestResult" jsonb,
    "createdByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "alertCpuThreshold" double precision DEFAULT 90.0 NOT NULL,
    "alertDiskThreshold" double precision DEFAULT 90.0 NOT NULL,
    "alertRamThreshold" double precision DEFAULT 95.0 NOT NULL,
    "metricsEnabled" boolean DEFAULT true NOT NULL,
    "metricsInterval" integer DEFAULT 900 NOT NULL
);


ALTER TABLE public.servers OWNER TO opsmanager;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "refreshToken" text NOT NULL,
    "ipAddress" text NOT NULL,
    "userAgent" text NOT NULL,
    "deviceFingerprint" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "lastActivityAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sessions OWNER TO opsmanager;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.settings (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "isEncrypted" boolean DEFAULT false NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.settings OWNER TO opsmanager;

--
-- Name: users; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text,
    "lastName" text,
    "avatarUrl" text,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    "mfaBackupCodes" text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "isLocked" boolean DEFAULT false NOT NULL,
    "lockoutUntil" timestamp(3) without time zone,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" text,
    "passwordChangedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mustChangePassword" boolean DEFAULT true NOT NULL,
    "passwordHistory" text[],
    "roleId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public.users OWNER TO opsmanager;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.webhook_events (
    id text NOT NULL,
    "integrationId" text NOT NULL,
    "eventType" text NOT NULL,
    payload jsonb NOT NULL,
    headers jsonb,
    processed boolean DEFAULT false NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "processingError" text,
    "sourceIp" text,
    "userAgent" text,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.webhook_events OWNER TO opsmanager;

--
-- Name: wp_sites; Type: TABLE; Schema: public; Owner: opsmanager
--

CREATE TABLE public.wp_sites (
    id text NOT NULL,
    "serverId" text NOT NULL,
    domain text NOT NULL,
    path text NOT NULL,
    "cPanelUsername" text,
    "wpVersion" text,
    "phpVersion" text,
    "dbName" text,
    "dbHost" text DEFAULT 'localhost'::text,
    "healingMode" public."HealingMode" DEFAULT 'MANUAL'::public."HealingMode" NOT NULL,
    "isHealerEnabled" boolean DEFAULT false NOT NULL,
    "maxHealingAttempts" integer DEFAULT 3 NOT NULL,
    "healingCooldown" integer DEFAULT 15 NOT NULL,
    "blacklistedPlugins" text[] DEFAULT ARRAY['woocommerce'::text, 'woocommerce-*'::text],
    "blacklistedThemes" text[],
    "healthStatus" public."HealthStatus" DEFAULT 'UNKNOWN'::public."HealthStatus" NOT NULL,
    "lastHealthCheck" timestamp(3) without time zone,
    "healthScore" integer,
    "lastError" text,
    "lastHealedAt" timestamp(3) without time zone,
    "healingAttempts" integer DEFAULT 0 NOT NULL,
    "lastDiagnosedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "availableSubdomains" jsonb,
    "circuitBreakerResetAt" timestamp(3) without time zone,
    "circuitBreakerState" public."CircuitBreakerState" DEFAULT 'CLOSED'::public."CircuitBreakerState" NOT NULL,
    "consecutiveFailures" integer DEFAULT 0 NOT NULL,
    "lastCircuitBreakerOpen" timestamp(3) without time zone,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "retryDelayMs" integer DEFAULT 5000 NOT NULL,
    "retryStrategy" public."RetryStrategy" DEFAULT 'EXPONENTIAL'::public."RetryStrategy" NOT NULL
);


ALTER TABLE public.wp_sites OWNER TO opsmanager;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
d7c1622d-02ab-4cef-8d71-40ff59d4d461	e0a3dbcce03d96c5f7b846585dcfc569253aba20bb70f8a640747c158c5d7d70	2026-02-26 07:40:23.233835+00	20260226074022_	\N	\N	2026-02-26 07:40:22.831659+00	1
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.audit_logs (id, "userId", "actorType", "actorId", action, resource, "resourceId", description, metadata, "ipAddress", "userAgent", severity, "timestamp") FROM stdin;
daa46c1d-d86b-4153-a292-193aae0caeb7	\N	USER	\N	LOGIN_FAILED	AUTH	\N	Login failed: User not found (admin@opsmanager.local)	{}	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	WARNING	2026-02-26 07:50:51.116
f5fff802-7668-4982-b7c4-dfb8b73271d6	\N	USER	\N	LOGIN_FAILED	AUTH	\N	Login failed: User not found (admin@opsmanager.local)	{}	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	WARNING	2026-02-26 07:50:52.365
f92974fa-730f-48dc-b92c-8a5ad8e8baec	\N	USER	\N	LOGIN_FAILED	AUTH	\N	Login failed: User not found (admin@opsmanager.local)	{}	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	WARNING	2026-02-26 07:51:04.34
e02d2696-ae78-451f-ba6b-a2fb6f9b176a	\N	SYSTEM	\N	DATABASE_SEED	SYSTEM	\N	Database seeded with default roles and admin user	{"rolesCreated": 4, "usersCreated": 1}	\N	\N	INFO	2026-02-26 07:53:03.314
296a5be1-4692-4f52-a7d6-e26bc80f225b	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	LOGIN_FAILED	AUTH	\N	Login failed: Invalid password (attempt 1/5)	{}	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	WARNING	2026-02-26 07:53:06.56
b3970b62-f890-4803-ab64-3708c02ff9e0	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	LOGIN_FAILED	AUTH	\N	Login failed: Invalid password (attempt 2/5)	{}	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	WARNING	2026-02-26 07:53:08.218
fdcbb6db-3453-4b32-96b1-aae47e885d90	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	LOGIN	AUTH	\N	User logged in successfully	{}	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	INFO	2026-02-26 07:53:22.026
08cb329b-5dc7-41f9-914c-9648bf912711	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	SERVER_CREATED	server	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	Server "PCP3" created	{"host": "pcp3.mywebsitebox.com", "authType": "SSH_KEY_WITH_PASSPHRASE", "serverName": "PCP3", "platformType": "LINUX", "hostKeyStrategy": "TOFU"}	\N	\N	INFO	2026-02-26 08:10:08.307
df92aada-232f-4758-af7d-c12a73ee993e	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	HOST_KEY_TOFU_SELECTED	server	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	Server "PCP3" created with TOFU host key strategy	{"serverName": "PCP3"}	\N	\N	WARNING	2026-02-26 08:10:08.31
6693ffc2-2ae0-4599-b2f2-a16b47d8efd7	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	CONNECTION_TEST_SUCCESS	server	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	Connection test successful for server "PCP3"	{"latency": 5000, "detectedOS": "Linux pcp3.mywebsitebox.com 4.18.0-477.15.1.lve.2.el8.x86_64 #1 SMP Wed Aug 2 10:43:45 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux", "serverName": "PCP3"}	\N	\N	INFO	2026-02-26 08:10:35.62
58bcbae9-5707-4d35-8fbc-f38d8a73a97e	b42888ee-60be-47a3-a65c-98163f6b349d	USER	\N	HOST_KEY_TOFU_ACCEPT	server	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	First connection to server "PCP3" - host key accepted via TOFU	{"serverName": "PCP3"}	\N	\N	WARNING	2026-02-26 08:10:35.631
\.


--
-- Data for Name: diagnosis_cache; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.diagnosis_cache (id, "serverId", "sitePath", domain, profile, result, "healthScore", "createdAt", "expiresAt", "hitCount", "lastAccessedAt") FROM stdin;
\.


--
-- Data for Name: diagnosis_history; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.diagnosis_history (id, "siteId", subdomain, domain, profile, "checksRun", "diagnosisType", "healthScore", "issuesFound", "criticalIssues", "warningIssues", "diagnosisDetails", "commandOutputs", duration, "triggeredBy", trigger, "createdAt") FROM stdin;
\.


--
-- Data for Name: email_history; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.email_history (id, "ruleId", "templateKey", recipients, subject, "htmlBody", "textBody", variables, status, "sentAt", "failedAt", error, "deliveryStatus", "triggeredBy", "triggerEvent", "createdAt") FROM stdin;
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.email_templates (id, key, name, subject, "htmlBody", "textBody", variables, "isSystem", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: healer_alerts; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healer_alerts (id, title, message, metadata, "acknowledgedAt", "acknowledgedBy", "alertType", "createdAt", "executionId", "resolvedAt", "siteId", severity, status) FROM stdin;
\.


--
-- Data for Name: healer_audit_logs; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healer_audit_logs (id, resource, details, changes, success, "timestamp", duration, "errorMessage", "executionId", "ipAddress", "resourceType", "siteId", "userAgent", "userEmail", "userId", action) FROM stdin;
\.


--
-- Data for Name: healer_backups; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healer_backups (id, "siteId", "backupType", "filePath", "fileSize", "backupData", status, "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: healer_executions; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healer_executions (id, "siteId", trigger, "triggeredBy", "diagnosisType", "diagnosisDetails", confidence, "logsAnalyzed", "suggestedAction", "suggestedCommands", "actionTaken", "backupId", status, "errorMessage", "executionLogs", "startedAt", "diagnosedAt", "approvedAt", "healedAt", "verifiedAt", "finishedAt", duration, "preHealthScore", "postHealthScore", "wasSuccessful", subdomain, "aiAnalysis", "aiConfidence", "aiModel", "aiReasoning", "aiRecommendations", "aiTokensUsed", "attemptNumber", "maxAttempts", "postHealingMetrics", "preHealingMetrics", "previousAttemptId", "retryAfter", "retryReason", "verificationChecks", "verificationResults", "verificationScore") FROM stdin;
\.


--
-- Data for Name: healer_metrics; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healer_metrics (id, "avgDiagnosisTime", "avgHealingTime", "avgVerificationScore", "createdAt", "dbErrorCount", "failedHealings", "firstAttemptSuccessRate", "healingSuccessRate", "healthyCount", "otherErrorCount", "patternSuccessRate", "patternsApplied", "patternsLearned", "periodEnd", "periodStart", "periodType", "rolledBackHealings", "successfulHealings", "syntaxErrorCount", "totalDiagnoses", "totalHealings", "wsodCount") FROM stdin;
\.


--
-- Data for Name: healing_action_logs; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healing_action_logs (id, "executionId", "siteId", "actionType", "actionDetails", "beforeState", "afterState", "backupId", status, "errorMessage", duration, "canRollback", "rolledBackAt", "rollbackReason", "requiresApproval", "approvedBy", "approvedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: healing_patterns; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healing_patterns (id, "diagnosisType", "errorType", culprit, "errorPattern", commands, description, "successCount", "failureCount", confidence, "autoApproved", "requiresBackup", "createdBy", "lastSuccessAt", "lastFailureAt", "createdAt", "updatedAt", "lastUsedAt", "commandSequence", verified, "verifiedAt", "verifiedBy") FROM stdin;
\.


--
-- Data for Name: healing_workflows; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.healing_workflows (id, "siteId", name, description, "diagnosisType", steps, "currentStep", status, "isPaused", "pausedAt", "pauseReason", "requiresStepApproval", "autoResumeAfter", "completedSteps", "failedSteps", "skippedSteps", "startedAt", "completedAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: health_score_history; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.health_score_history (id, "siteId", score, profile, "availabilityScore", "performanceScore", "securityScore", "integrityScore", "maintenanceScore", "createdAt") FROM stdin;
\.


--
-- Data for Name: integrations; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.integrations (id, name, description, provider, "baseUrl", username, "encryptedConfig", "isActive", "lastSyncAt", "healthStatus", "lastTestAt", "lastTestSuccess", "lastTestMessage", "lastTestLatency", "lastError", "linkedServerId", "createdByUserId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: manual_diagnosis_sessions; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.manual_diagnosis_sessions (id, "siteId", commands, status, findings, "learnedPatternId", "startedBy", "createdAt", "completedAt") FROM stdin;
\.


--
-- Data for Name: notification_rules; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.notification_rules (id, name, description, trigger, "templateKey", "recipientType", "recipientValue", conditions, priority, "isActive", "createdBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.password_reset_tokens (id, "userId", "tokenHash", "expiresAt", used, "createdAt") FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.permissions (id, resource, action, "roleId") FROM stdin;
c17056d6-4ac9-484b-a410-ea0b7f23da7b	*	*	3a98b89e-8aaf-4bde-a2a2-2f020d6e7338
cce34818-ebbd-43a8-8c4d-b4d6c64cb5b5	users	read	23fcbc7a-96cc-495c-8b26-621aadf9ee09
23c55b00-de3d-44e3-ac87-ae211aedeb02	users	create	23fcbc7a-96cc-495c-8b26-621aadf9ee09
7ee283b4-e35c-42dc-b121-3b655f6bfa95	users	update	23fcbc7a-96cc-495c-8b26-621aadf9ee09
b635364c-e9bd-410b-8ca4-27e229181479	servers	*	23fcbc7a-96cc-495c-8b26-621aadf9ee09
8d10fa21-c360-4baa-b2d9-f3e13e828528	sites	*	23fcbc7a-96cc-495c-8b26-621aadf9ee09
a7c00193-7a3c-4886-a2a1-97672618143c	incidents	*	23fcbc7a-96cc-495c-8b26-621aadf9ee09
8ce8f37a-5c7a-4e59-be9e-2aaea3fba200	settings	read	23fcbc7a-96cc-495c-8b26-621aadf9ee09
b7d4d721-88bc-4474-9c5c-b7001f8c75bf	settings	update	23fcbc7a-96cc-495c-8b26-621aadf9ee09
03698047-c838-4316-97db-3c5f6f39c7b1	audit	read	23fcbc7a-96cc-495c-8b26-621aadf9ee09
b3d4ee91-9046-4186-8b3a-859d6c60eebd	incidents	*	b8b767da-6d7d-411f-a624-6db5887e062a
a5956913-367c-4e7a-9b84-487b30757228	sites	read	b8b767da-6d7d-411f-a624-6db5887e062a
ecd75b4d-5466-44b0-98c5-aa98027f84bb	servers	read	b8b767da-6d7d-411f-a624-6db5887e062a
8c0cdc95-c2af-4a61-ac83-c2af5b40ecd4	servers	test	b8b767da-6d7d-411f-a624-6db5887e062a
979bfff5-aea0-409e-9010-bd7f015e8690	audit	read	b8b767da-6d7d-411f-a624-6db5887e062a
f8d02d4a-7ad7-48ad-ac0a-1bcb5a60d619	*	read	34e7e7c0-06bc-4293-9e3f-dd8dfdabfd24
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.roles (id, name, "displayName", description, "isSystem", "createdAt", "updatedAt") FROM stdin;
3a98b89e-8aaf-4bde-a2a2-2f020d6e7338	SUPER_ADMIN	Super Administrator	Full system access with all permissions	t	2026-02-26 07:53:03.212	2026-02-26 07:53:03.212
23fcbc7a-96cc-495c-8b26-621aadf9ee09	ADMIN	Administrator	Administrative access to manage users, servers, and incidents	t	2026-02-26 07:53:03.239	2026-02-26 07:53:03.239
b8b767da-6d7d-411f-a624-6db5887e062a	ENGINEER	Engineer	Engineering access to manage incidents and view infrastructure	t	2026-02-26 07:53:03.243	2026-02-26 07:53:03.243
34e7e7c0-06bc-4293-9e3f-dd8dfdabfd24	VIEWER	Viewer	Read-only access to view system information	t	2026-02-26 07:53:03.245	2026-02-26 07:53:03.245
\.


--
-- Data for Name: scheduled_diagnosis; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.scheduled_diagnosis (id, "siteId", enabled, profile, "intervalMinutes", "maintenanceWindowStart", "maintenanceWindowEnd", timezone, "autoHealEnabled", "autoHealTypes", "alertOnIssues", "alertChannels", "alertThreshold", "lastRunAt", "nextRunAt", "consecutiveFailures", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: server_metrics; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.server_metrics (id, "serverId", "cpuUsagePercent", "cpuCores", "loadAverage1m", "loadAverage5m", "loadAverage15m", "memoryTotalMB", "memoryUsedMB", "memoryFreeMB", "memoryAvailableMB", "memoryUsagePercent", "swapTotalMB", "swapUsedMB", "swapUsagePercent", "diskTotalGB", "diskUsedGB", "diskFreeGB", "diskUsagePercent", "diskReadMBps", "diskWriteMBps", "diskIops", "networkRxMBps", "networkTxMBps", "networkRxTotalMB", "networkTxTotalMB", uptime, "processCount", "threadCount", "detectedOS", "kernelVersion", "collectionLatency", "collectionSuccess", "collectionError", "collectedAt") FROM stdin;
ad3ea082-5dce-4ba2-985e-2039334ff123	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	53.5	24	4.64	4.97	5.03	38992	14543	1068	18940	37.3	4095	747	18.24	675.64	568.63	107.02	84.2	\N	\N	\N	\N	\N	58993.14	510718.62	161197	668	\N	CloudLinux 8.10 (Vladimir Aksyonov)	4.18.0-477.15.1.lve.2.el8.x86_64	4832	t	\N	2026-02-26 08:10:46.525
\.


--
-- Data for Name: server_test_history; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.server_test_history (id, "serverId", "triggeredByUserId", success, message, latency, details, "detectedOS", "detectedUsername", errors, warnings, "testedAt") FROM stdin;
0c789f36-23f4-4cbd-9548-6f71f080d7a6	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	b42888ee-60be-47a3-a65c-98163f6b349d	t	Connection test successful	5000	{"dnsResolution": {"ip": "135.181.231.205", "time": 79, "success": true}, "privilegeTest": {"hasRoot": false, "hasSudo": false, "success": true}, "tcpConnection": {"time": 3045, "success": true}, "authentication": {"time": 3045, "success": true}, "commandExecution": {"whoami": {"output": "root\\n", "success": true}, "systemInfo": {"output": "Linux pcp3.mywebsitebox.com 4.18.0-477.15.1.lve.2.el8.x86_64 #1 SMP Wed Aug 2 10:43:45 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux\\n", "success": true}}, "hostKeyVerification": {"matched": true, "success": true}}	Linux pcp3.mywebsitebox.com 4.18.0-477.15.1.lve.2.el8.x86_64 #1 SMP Wed Aug 2 10:43:45 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux	root	{}	{"First connection - accepting host key (TOFU)"}	2026-02-26 08:10:30.593
\.


--
-- Data for Name: servers; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.servers (id, name, environment, tags, notes, "platformType", host, port, "connectionProtocol", username, "authType", "encryptedPrivateKey", "encryptedPassphrase", "encryptedPassword", "privilegeMode", "sudoMode", "encryptedSudoPassword", "hostKeyStrategy", "knownHostFingerprints", "lastTestStatus", "lastTestAt", "lastTestResult", "createdByUserId", "createdAt", "updatedAt", "deletedAt", "alertCpuThreshold", "alertDiskThreshold", "alertRamThreshold", "metricsEnabled", "metricsInterval") FROM stdin;
1627c6b4-6f30-4606-a5b7-7717c9ba8be3	PCP3	PROD	{}	\N	LINUX	pcp3.mywebsitebox.com	22022	SSH	root	SSH_KEY_WITH_PASSPHRASE	nA45MCuX0T59QEhFac7XRHzkF0fG/ou/FhV648Lji8BurOpbmB1xSc8siwRehTNHg44qpLBtfKawoHIHMMikHjjDJOyvJaYBmLvSEYLB15QlHzDJ6qDu/UEdXsbP2r3CbySBoC/rq/tPRwRwtgsEvFqirNBnYLYco/eCGQRnLUvIjPyYjiMLz03abmAty0/9cPQm4ZKuhMZq+NcEjRm+LUZK7DH98gx9SZooez2DF5rax1+QOHSKsCYtYDioOkOw18YmbHoN4/q8aY1LJTbp2vtP8a8kaK4NFmQMcLBRbSDMNocXU0C6i8hbI9JnBxwbDCGVv4+Gp87NLyvaW3zYSWdCxDvS4WjLE2lpxShZcY8EN+KBXRSFkKlEvNPMJdJA6wCoBRGtB8Gh3OEdmriJRLoZZOyjZBViOY1oZX+Ps+mZvq9yW+wGXB6X5b6ELrwweU3Rmrntni/IviQEaEQufsKXD1oURAKzu7ah5dshZ9fi9h1Gs6mUmCJmDBcXd2Z1NazsGiMl7s9Ijqrpf0M2Br2VJHzDCMe9z6UihfGN6Rvgp4Hzl+D6qf2DtW05jYVPwD++pLDyUOorCg3H/Ld0+2mJwYRLF8VbNmK9NW7FFNWmxLx49zMleFr0kdBFwT5mlyt5OsjPMAcbdLZKuFlhrb0uBC7+wcvbCOtiUjI+A5owW/SeluAwS/yg3j9S4680AY3Cy7lpPeXDd8a+arjBXABqHQx4L94BnD5GS160aVCpS+o25fnQwZsnU7mW9bo7YzJlLAWWgUEfYwDB91hbEu+rMhkIkPY8LsxjAu9lcdBxU/LuKdslgzMcOeFqntoh/CPfdF/AX0L2oNk8PqOcOsoGkqqBLW2o0qNOqN/YF4kvys0/MxAUe4WdcNs6MwpFcB2l1hFdMJZBJtxWXG5d0McZoBBa/mNFv8QFlME9xBN92QBFSW3GHSCIYGHjrgpE+TKdIodtwvdzG/lILCWRpvuqWy4Hj1cQfPA4MMsq9d5ARzXvQutum3Yu5DEkjm/sSM+fYYHuiKywVd7QWk6XnC7CrPQ5JzGBU5+CeX0vjUhwUHV/T5y1XR1v0PZghLDDRwCruBY63mhE91i0QhX/t/7ZfaVCF/MHQ59FUlCnreuNEvza7agHyKZScrO1yVeP/LtjRsbx6Bdt711N8cYoxJthQwAAFvQFQEw62vcFh+W7C8PJMHcrOwqfxDFN6Sry1qfWuYtECPFbHP6A8ZLRscWsGzmTBrkksyLw/tNkjO5Ew4KRA4HdAwC5Lif3sgmc+/SdCiJm7Rzg0TI8Fw2kTNYXhPuFdtsUA5G4EwIMo3g2eInv35k9mKodoFBKwlY9SqKCZgJ+7A/X9tZMmjmkjCqMDfcFz7gSbElMukR3OuGbMWMVhKIC5ptiRMMB9KMvadnU4cSu9VaV7K4SM5hRwHWU+dH75BVWB1ibuiJrSgo8uSn6ZLNAVmkGKKQkU49H5NvrjOpyWtD5cDhAKNj9Cui7XjKbLOD7YKaBg8FB4ASTC5WG+PJHrzYOuDG5i0QtlLkbZm6bXbpjJCwQph600pFvtU40tXfSzLcn8VcnwRapkBJscW/0gfWfXCt/+Tbrz3tkjrEyZvUqluRtW7UQDOLVnc7lsgLhQYAC0cxIu4seHnD4XU7yFPELUi4UK9ssRC0YHbANR5botbfJLgcJjxcYtlmvIOwAXl6i1zpiAgdRL0492ILCf2y4VHu6vLLhYQpzbV+G+x2t0LeQGr0AruSeg+IiiuIMybuHXYI1JdZX7REGavQeZ/CCBPjim3guELUwNZd6IUYpNvoNd9qwXYTiPzuZS0xdk+7gePsWoOnsyQRk1l3gUVTs9i6ISo3YvEtHcYxLBHvQlve0oafZwgPqH48FSdkDnbznEF7ab8Wmbxx6pQRKBTPYjGYjguCnahfQ34C8/B91Q59BJHKjiSTAZzL4Rw8SR86TC+INkg2Oa4s2OwUboUhoknOHesZwVELCLviOfWbKzUuXAW5KNmw/+RxMHQyy6DS3lpI47E5yMXQLcmrdq396hV1fpxwPSyfNkDsl/xkzU4GY0e1y5AW45wBhsqgdil9x4DhZxYsnbvs/Ih/NF4BstDV2xxAqVaUI0GPgv4xASoK2hrT3/S9vyO0+hQHQ6ejYI5/HYfvLXsFkGbzhEEEpSbauvly++M6eOVhkLFhhlT6ugo0yTfPtUjdd6vGPFJagsH1AmX17tXSo8N2iZTT05x5jHmI7CllRTsYm9EoOnFV17K8WqBXl4Tq0jIEPMyAb5Hr8aj2DM9FE6P6h0vHsyLXN4Lt0pvSxj0dAbd0XIppgPsT5kq5OPD2pqWc0SdYRkiN12Zn2LGWo2DZ0Iq95iSV5LvyA+2asHBq0ZzfRVSlDeK/5HcefXYPHgFVrp0I5xQlSD9EmGxLaRR+z2UFoRSO7HoX4J5MnFj2zGD4LwFskRW6BmjTaWHP2olwDx1Ha4q2PJtEhne4ztAVV3oecF3WTilSQL2Q+8kEUSCk4HTdSQQtDfAJYMqdjFrc=	g8Y2c5LXprcOWm6XM6CIYRzH9B2nbykO3ZaL9lB7ePg17X20/1VAzega2D8QMLkCxgE=	\N	ROOT	NONE	\N	TOFU	[{"firstSeenAt": "2026-02-26T08:10:35.636Z", "lastVerifiedAt": "2026-02-26T08:10:35.636Z"}]	OK	2026-02-26 08:10:35.594	{"errors": [], "details": {"dnsResolution": {"ip": "135.181.231.205", "time": 79, "success": true}, "privilegeTest": {"hasRoot": false, "hasSudo": false, "success": true}, "tcpConnection": {"time": 3045, "success": true}, "authentication": {"time": 3045, "success": true}, "commandExecution": {"whoami": {"output": "root\\n", "success": true}, "systemInfo": {"output": "Linux pcp3.mywebsitebox.com 4.18.0-477.15.1.lve.2.el8.x86_64 #1 SMP Wed Aug 2 10:43:45 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux\\n", "success": true}}, "hostKeyVerification": {"matched": true, "success": true}}, "latency": 5000, "message": "Connection test successful", "success": true, "testedAt": "2026-02-26T08:10:30.593Z", "warnings": ["First connection - accepting host key (TOFU)"], "detectedOS": "Linux pcp3.mywebsitebox.com 4.18.0-477.15.1.lve.2.el8.x86_64 #1 SMP Wed Aug 2 10:43:45 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux", "detectedUsername": "root"}	b42888ee-60be-47a3-a65c-98163f6b349d	2026-02-26 08:10:08.3	2026-02-26 08:10:35.637	\N	90	90	95	t	300
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.sessions (id, "userId", token, "refreshToken", "ipAddress", "userAgent", "deviceFingerprint", "expiresAt", "lastActivityAt", "createdAt") FROM stdin;
c7286ed5-e01b-491b-8bee-8ace356cc147	b42888ee-60be-47a3-a65c-98163f6b349d	4cd41695d3c9d0f7266c29da31496f8af2273e8c6d13c7ca4da0a0f5115e84a9	fa7a1b2077705350a5eead8eddc9085472bf502c5be1c4513edf5bbdcc5b759b	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	\N	2026-03-05 07:53:22.016	2026-02-26 07:53:22.016	2026-02-26 07:53:22.02
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.settings (id, key, value, "isEncrypted", description, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.users (id, email, username, "passwordHash", "firstName", "lastName", "avatarUrl", "mfaEnabled", "mfaSecret", "mfaBackupCodes", "isActive", "isLocked", "lockoutUntil", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "passwordChangedAt", "mustChangePassword", "passwordHistory", "roleId", "createdAt", "updatedAt", "deletedAt") FROM stdin;
b42888ee-60be-47a3-a65c-98163f6b349d	admin@opsmanager.local	admin	$argon2id$v=19$m=65536,t=3,p=4$dmAIMhgN/zbWBSPP6Gjy4A$hO3VpLJ8yySMrpoh7ZlY2MUKhBaXNYp2XFuj7RsspB4	System	Administrator	\N	f	\N	\N	t	f	\N	0	2026-02-26 07:53:22.009	::1	2026-02-26 07:53:03.308	t	\N	3a98b89e-8aaf-4bde-a2a2-2f020d6e7338	2026-02-26 07:53:03.309	2026-02-26 07:53:22.01	\N
\.


--
-- Data for Name: webhook_events; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.webhook_events (id, "integrationId", "eventType", payload, headers, processed, "processedAt", "processingError", "sourceIp", "userAgent", "receivedAt") FROM stdin;
\.


--
-- Data for Name: wp_sites; Type: TABLE DATA; Schema: public; Owner: opsmanager
--

COPY public.wp_sites (id, "serverId", domain, path, "cPanelUsername", "wpVersion", "phpVersion", "dbName", "dbHost", "healingMode", "isHealerEnabled", "maxHealingAttempts", "healingCooldown", "blacklistedPlugins", "blacklistedThemes", "healthStatus", "lastHealthCheck", "healthScore", "lastError", "lastHealedAt", "healingAttempts", "lastDiagnosedAt", "createdAt", "updatedAt", "availableSubdomains", "circuitBreakerResetAt", "circuitBreakerState", "consecutiveFailures", "lastCircuitBreakerOpen", "maxRetries", "retryDelayMs", "retryStrategy") FROM stdin;
6bb05a8c-c72c-4dbc-8c5f-84a1069b5bb8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	3sixty.pk	/home/sixtypk/public_html	sixtypk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.488	2026-02-26 08:11:37.488	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
4325abf7-119d-457b-a123-b0744f9cc7c4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	3xsports.co.uk	/home/kaonxwl/public_html	kaonxwl	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.509	2026-02-26 08:11:37.509	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a1e475b0-2e34-4cbc-b7bd-afe6c1800992	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	a4techsolutions.com	/home/atechso1/public_html	atechso1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.522	2026-02-26 08:11:37.522	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f4274022-6749-4359-a746-59e2868a3029	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	aairveerz.com	/home/aairvee1/public_html	aairvee1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.536	2026-02-26 08:11:37.536	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
02c47f81-c60e-469b-a357-c33adb07df3d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	abtcme.com	/home/bisgccom/public_html	bisgccom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.549	2026-02-26 08:11:37.549	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
54a732eb-4a26-4226-ab92-a031af0f0a10	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	adxasol.com	/home/adxasolc/public_html	adxasolc	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.563	2026-02-26 08:11:37.563	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f13d275b-9278-4214-b974-ef7d76dc6593	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	aerotoolshub.pk	/home/aerotool/public_html	aerotool	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.575	2026-02-26 08:11:37.575	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
6cea3ec0-6c53-4095-9cef-0125def731d8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	aestheticbysmk.com	/home/aesthet2/public_html	aesthet2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.586	2026-02-26 08:11:37.586	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3e892448-3f23-494b-9a13-3fd6aea6e6ab	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	aewori.pk	/home/aeworipk/public_html	aeworipk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.598	2026-02-26 08:11:37.598	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
42d8b453-8b03-4ce4-9fd1-1ff2c3548224	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	agilefullstack.com	/home/agileful/public_html	agileful	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.609	2026-02-26 08:11:37.609	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
fcea4add-ae79-4414-abf2-dd81949be8a8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	agisksa.com	/home/agisksac/public_html	agisksac	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.621	2026-02-26 08:11:37.621	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a47d1a5b-3f20-47e0-aab5-ddeab88ab8d5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ahmedtrdg.com	/home/ahmedtrd/public_html	ahmedtrd	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.633	2026-02-26 08:11:37.633	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
866c2c2d-8f49-44d7-be50-1e9b8ff89f12	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ahslog.com	/home/ahslogco/public_html	ahslogco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.644	2026-02-26 08:11:37.644	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
59bda95d-c902-46fa-a791-8dfcd3785635	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ai.hostbreak.com	/home/aihostbr/public_html	aihostbr	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.656	2026-02-26 08:11:37.656	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3a49b2a0-9a45-4a6a-a221-fcfabe2133f1	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	akramimpex.com.pk	/home/akramimp/public_html	akramimp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.667	2026-02-26 08:11:37.667	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f2e46457-0c05-44e1-91cc-6f73632a4d9f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	aljahedllc.com	/home/aljahedl/public_html	aljahedl	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.678	2026-02-26 08:11:37.678	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f3d48777-3d95-4c5c-be57-1157e1eea4b8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	alkhilafahtalakhirah.org	/home/alkhilafa2/public_html	alkhilafa2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.69	2026-02-26 08:11:37.69	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
9a145be9-dff1-4247-97af-44c307b3f0c5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	almadinah.com.pk	/home/almadin4/public_html	almadin4	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.701	2026-02-26 08:11:37.701	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0e980c0b-5bc1-4514-a49e-08bd313c4356	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	amzxpress.co	/home/amzxpres/public_html	amzxpres	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.712	2026-02-26 08:11:37.712	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
4d10f567-cc3b-4096-8b70-18fdc0df7466	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ancientfood.com.pk	/home/ancientf/public_html	ancientf	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.723	2026-02-26 08:11:37.723	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a679fbe9-a5a0-4205-9cea-d5c62646efba	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	anekorpakistan.com	/home/anekorpa/public_html	anekorpa	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.734	2026-02-26 08:11:37.734	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a86ee37a-0210-4b1a-9152-6298060b3228	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	apexcargopartners.pk	/home/apexcarg/public_html	apexcarg	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.745	2026-02-26 08:11:37.745	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
276f8578-a3de-488b-b95e-d308c64bf04c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	appseenstudio.com	/home/appseens/public_html	appseens	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.757	2026-02-26 08:11:37.757	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
800e77f0-e450-4b13-9a74-58b3291d6c75	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	arenabysunrise.com	/home/arenabys/public_html	arenabys	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.768	2026-02-26 08:11:37.768	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
75522a2d-cc92-44f4-9f73-c79d0cc03295	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	arinienterprise.com	/home/arinient/public_html	arinient	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.778	2026-02-26 08:11:37.778	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
30707479-a26f-4ae9-b5b7-529eaf06d7d5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	artmenwork.com	/home/artmenwo/public_html	artmenwo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.79	2026-02-26 08:11:37.79	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
fe4db02f-52bb-4c7d-885d-340f29cabd52	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	aspak.biz	/home/aspakbiz/public_html	aspakbiz	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.801	2026-02-26 08:11:37.801	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
bb4a88af-334c-4e4c-969a-9d74334c73e6	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	atbservices.com.pk	/home/atbservi/public_html	atbservi	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.811	2026-02-26 08:11:37.811	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f1d56562-3c95-4037-99f8-cd5647eac4c5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	atherkhanllc.com	/home/atherkha/public_html	atherkha	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.823	2026-02-26 08:11:37.823	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
48d0e027-44f9-4413-9fb6-068cb686dd0b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	avembroidery.com	/home/avembroi/public_html	avembroi	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.833	2026-02-26 08:11:37.833	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5c05d74c-fa19-4d1c-b760-1b317106738f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ayshi.ae	/home/ayshiae/public_html	ayshiae	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.844	2026-02-26 08:11:37.844	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b7f5224b-a3fc-43d5-ab98-3018292c2f0c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	azeemstore.com.pk	/home/azeemsto/public_html	azeemsto	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.856	2026-02-26 08:11:37.856	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ed96d82d-3621-420d-b4bb-55ffd263a1d6	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	azlidtech.com	/home/azlidtec/public_html	azlidtec	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.867	2026-02-26 08:11:37.867	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b430a3bc-684e-44db-93b9-e2fff703c043	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	badarabro.com	/home/badarabr/public_html	badarabr	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.877	2026-02-26 08:11:37.877	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e54e064c-c932-4b9f-8807-c8ca66b5bfff	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bahmad5680.com	/home/bahmadc1/public_html	bahmadc1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.889	2026-02-26 08:11:37.889	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
8931fb26-e96c-4e46-983f-e2159a793e2d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	barnkladerindustry.com	/home/barnklad/public_html	barnklad	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.9	2026-02-26 08:11:37.9	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
acd04daa-6e17-4339-a7dd-d612eaaff5eb	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	basahulat.com	/home/basahula/public_html	basahula	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.911	2026-02-26 08:11:37.911	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e44b6faa-887f-4ebd-a69d-8b9f543e1431	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	baygpharma.com	/home/baygpha1/public_html	baygpha1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.922	2026-02-26 08:11:37.922	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
8d722eb8-c27f-449d-afad-8eab05bd8503	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	beepwelldaily.com	/home/beepwell/public_html	beepwell	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.932	2026-02-26 08:11:37.932	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a4c6303b-93b6-4161-92ae-9bb42d630d15	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bergassociates.pk	/home/bergasso/public_html	bergasso	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.943	2026-02-26 08:11:37.943	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b79f174f-4e8b-4b86-b521-2807a11ee6c2	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bfmedicalcenter.com	/home/bfmedical1/public_html	bfmedical1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.955	2026-02-26 08:11:37.955	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
2fe589d6-df29-46cd-8549-0ec8b6d62755	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bilaltoys.com	/home/bilaltoy/public_html	bilaltoy	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.966	2026-02-26 08:11:37.966	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
9f5d7c17-ca77-4450-8d42-8c7234f26f60	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bindawoodfisheries.com.pk	/home/bindawoo/public_html	bindawoo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.978	2026-02-26 08:11:37.978	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
852acbf9-314e-4163-aaae-88a08803613b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bit1.pk	/home/jinglebe/public_html	jinglebe	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:37.989	2026-02-26 08:11:37.989	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
288b3d9f-059c-4978-b8cb-3d76c36bb395	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	blogmeta.pk	/home/blogmeta/public_html	blogmeta	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.002	2026-02-26 08:11:38.002	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
eb79def2-7de5-4520-a368-079489170770	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	blogyvlogy.com	/home/blogyvlo/public_html	blogyvlo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.014	2026-02-26 08:11:38.014	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
6472c502-a609-4632-b475-2b2589b8d0ef	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bridge-media.org	/home/bridgem3/public_html	bridgem3	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.026	2026-02-26 08:11:38.026	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b3c5abdb-4c9f-42c8-a5aa-c0ea31fd8d35	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	buttjewelers.com	/home/buttjewe/public_html	buttjewe	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.038	2026-02-26 08:11:38.038	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
33d9939f-ee55-4136-85b5-5d48c5ffe460	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	bzco.online	/home/bzcoonli/public_html	bzcoonli	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.05	2026-02-26 08:11:38.05	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
46af58d1-9de2-4991-aa4a-ea8e73f4e55f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	callshubsolutions.net	/home/callshub/public_html	callshub	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.061	2026-02-26 08:11:38.061	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3e883a5e-03b6-4e30-9b12-7c060fe6d0d7	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	carefreeinsure.com	/home/xagoshay/public_html	xagoshay	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.073	2026-02-26 08:11:38.073	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
54084fa4-b297-4803-bb79-805db10bf447	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ccpn.edu.pk	/home/ccpnedup/public_html	ccpnedup	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.084	2026-02-26 08:11:38.084	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
37e8dc03-5643-4817-bec4-8a9fa28ddee0	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	celstique.com	/home/celstiqu/public_html	celstiqu	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.095	2026-02-26 08:11:38.095	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5aced632-231a-490d-a8f8-edfce2d27b41	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	chakwaldoctors.work	/home/chakwald/public_html	chakwald	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.107	2026-02-26 08:11:38.107	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
1dca4b11-e7d1-490f-8dcf-6f045306d9b1	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	changezitech.com	/home/changezi/public_html	changezi	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.118	2026-02-26 08:11:38.118	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7e3c8872-165d-433b-a3a2-3e06c1eeea2c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	cmsfarca.com	/home/cmsfarca/public_html	cmsfarca	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.13	2026-02-26 08:11:38.13	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
2f68ecd5-f352-4fa3-9f4a-bc54bc1ea48c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	codecilia.com	/home/leevorco/public_html	leevorco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.143	2026-02-26 08:11:38.143	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0b006d75-b72f-425b-ba1a-110d2fb210fa	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	consult-techhub.com	/home/consultt/public_html	consultt	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.155	2026-02-26 08:11:38.155	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a065ab03-07d2-4e0e-a654-c572479799c6	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	cpap.pk	/home/cpappk/public_html	cpappk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.166	2026-02-26 08:11:38.166	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a5252740-209b-419b-97d6-ba53ae4c4e30	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	creativeiportal.com	/home/creativ9/public_html	creativ9	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.177	2026-02-26 08:11:38.177	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
955e9510-91f4-433a-9470-75123bcd79f8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	creativetestmaker.com	/home/creativ3/public_html	creativ3	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.19	2026-02-26 08:11:38.19	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b6277e11-717b-4384-afc8-ac2f61f38f0f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	currency-converter.pk	/home/currency/public_html	currency	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.202	2026-02-26 08:11:38.202	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3fabb862-a945-47bb-abc8-2f822030e744	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dailymagazine.com.pk	/home/chatgpta/public_html	chatgpta	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.213	2026-02-26 08:11:38.213	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c3026364-d362-449c-ba6e-49100b8efc6a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dasps.org	/home/daspsorg/public_html	daspsorg	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.225	2026-02-26 08:11:38.225	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
4607057e-8f50-4b33-abe5-a935fae2c251	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	decentricemill.com	/home/decentr2/public_html	decentr2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.237	2026-02-26 08:11:38.237	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ded3fa5f-2f00-48a5-9e2f-ba2506909dcf	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	deens.pk	/home/deenspk1/public_html	deenspk1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.249	2026-02-26 08:11:38.249	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
9d0e9302-3761-4ea1-b4a4-1f6fbe233b9d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	djangomango.pk	/home/djangoma/public_html	djangoma	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.26	2026-02-26 08:11:38.26	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
174bb174-74ef-4975-b966-9bb8039914b3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dlnash.com	/home/dlnashco/public_html	dlnashco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.272	2026-02-26 08:11:38.272	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
98659daf-49b4-449c-babd-a9c45c041a46	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	doctorscorner.pk	/home/doctorsc/public_html	doctorsc	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.283	2026-02-26 08:11:38.283	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
20984aee-8625-4dc5-8540-e883ba6d9a3a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dolphindivers.pk	/home/dolphind/public_html	dolphind	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.294	2026-02-26 08:11:38.294	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0e06021e-acc6-4147-9d20-a330af28098d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dravisstudio.com	/home/dravisst/public_html	dravisst	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.306	2026-02-26 08:11:38.306	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
686d655d-d18c-49c6-a85e-13c398fa451b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dryassermasood.com	/home/dryasser/public_html	dryasser	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.318	2026-02-26 08:11:38.318	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
cdb24e62-82ce-4a35-84c9-f9946761f7e1	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dsisajk.net	/home/dsisajkn/public_html	dsisajkn	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.329	2026-02-26 08:11:38.329	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
28804200-53f4-4b54-b183-03e6a466b1df	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	dtech.com.pk	/home/dtechcom/public_html	dtechcom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.34	2026-02-26 08:11:38.34	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
84e83e85-d08c-461c-b73e-3d4d3dc35815	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	earburn.com	/home/earburnc/public_html	earburnc	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.352	2026-02-26 08:11:38.352	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c3fc861c-6b38-47cf-a662-ae1730435449	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	easymap.pk	/home/easymapp/public_html	easymapp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.364	2026-02-26 08:11:38.364	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
6278c133-1f7e-47ec-8344-32aafe65a0c0	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ecorridoor.us	/home/ecorrido/public_html	ecorrido	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.377	2026-02-26 08:11:38.377	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b255c552-ac0a-432d-86ab-3c89804939c2	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	electnology.com	/home/electnol/public_html	electnol	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.389	2026-02-26 08:11:38.389	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
32ec75f3-2dda-4afe-a4fc-a826289f9812	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	equipmed.com.pk	/home/equipmed/public_html	equipmed	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.401	2026-02-26 08:11:38.401	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
bbcc0d0d-7111-4231-a6d2-9577f84d0044	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	exceinov.com	/home/softmode/public_html	softmode	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.411	2026-02-26 08:11:38.411	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c924d72d-f58a-4202-bac6-bbee4c0417d0	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	fakharauto-traders.com	/home/fakharau/public_html	fakharau	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.424	2026-02-26 08:11:38.424	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ef1f65a3-7607-4b8e-bdd2-d0ea45332df3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	familycare.com.pk	/home/familyca/public_html	familyca	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.435	2026-02-26 08:11:38.435	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a9d4dc57-c810-4e94-8bc6-20b9befd2093	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	fastonlinetaxreturn.com.au	/home/fastonli/public_html	fastonli	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.447	2026-02-26 08:11:38.447	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c9876449-2464-4a6b-90b0-e160535ce58f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	fnfconstruction.com.pk	/home/fnfconst/public_html	fnfconst	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.459	2026-02-26 08:11:38.459	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d40c8f2b-51b8-483e-875f-30c7431b62c6	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	fobrosgroup.com	/home/fobrosgr/public_html	fobrosgr	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.472	2026-02-26 08:11:38.472	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
4d726440-632f-44d8-b9d1-1b02fea0fa91	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	framify.pk	/home/framifyp/public_html	framifyp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.487	2026-02-26 08:11:38.487	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
25611fab-aff9-42ed-8d77-6de6238264e4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	freehospitalokr.com	/home/freehosp/public_html	freehosp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.503	2026-02-26 08:11:38.503	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
32466ad8-b82b-4505-b3e3-1c4ae6b342f7	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	gacliaquatpur.edu.pk	/home/gacliaq1/public_html	gacliaq1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.517	2026-02-26 08:11:38.517	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c5363ea3-0476-4f32-8ea6-742af2fbc88f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	globalworldtravel.co.uk	/home/globalwo/public_html	globalwo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.529	2026-02-26 08:11:38.529	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
cf3cd70c-c79f-432d-a3a0-284ab56af25f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	gmadmin.pk	/home/gmadminp/public_html	gmadminp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.541	2026-02-26 08:11:38.541	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d3e87d79-3da4-43d2-9f2e-1fe6d2f59b71	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	greengardensdynamic.com	/home/greengar/public_html	greengar	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.556	2026-02-26 08:11:38.556	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0714b248-705f-46c5-8738-5109d933915d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	gsgrowingsports.com	/home/gsgrowin/public_html	gsgrowin	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.572	2026-02-26 08:11:38.572	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
2f7b90d4-8b81-4d8f-8373-e13773464ed5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	gulbahar-center.com	/home/gulbahar/public_html	gulbahar	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.585	2026-02-26 08:11:38.585	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ceebf5ea-2b3b-444a-b4ad-62e108532155	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	hardentool.pk	/home/hardento/public_html	hardento	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.603	2026-02-26 08:11:38.603	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
88ad48d7-e7cc-4bd1-a5aa-053c6887c4d0	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	healthonemedicalsystem.pk	/home/healtho1/public_html	healtho1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.615	2026-02-26 08:11:38.615	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5307fd29-a9e2-4467-88e0-a2e3bde35df2	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	hereafterllc.com	/home/hereafte/public_html	hereafte	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.628	2026-02-26 08:11:38.628	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a3b5768b-7132-438b-bbde-ad636b1ceb99	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	hostbrake.com	/home/hostbr/public_html	hostbr	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.641	2026-02-26 08:11:38.641	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
973941de-d7e2-46ac-a097-b92d71008492	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	hsc.com.pk	/home/hsccomp1/public_html	hsccomp1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.654	2026-02-26 08:11:38.654	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
efa0a439-cdfb-4a73-a893-5706a2e0c30b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	hvctravels.com	/home/hvctrave/public_html	hvctrave	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.668	2026-02-26 08:11:38.668	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
6a8f8db2-0a8c-400d-ae0c-d6f0884c518f	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	iamawaisalam.com	/home/iamawais/public_html	iamawais	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.68	2026-02-26 08:11:38.68	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
41770c8c-beac-4eb7-91fb-c37fa488eed4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ideaz.com.pk	/home/ideazcom/public_html	ideazcom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.693	2026-02-26 08:11:38.693	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e3fa0ce0-c3b0-449c-80a4-e6a00489717d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ingcotool.pk	/home/ingcotoo/public_html	ingcotoo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.705	2026-02-26 08:11:38.705	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
13c54bf7-6bf4-4b5f-b9ab-f9facf504073	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	inspectacar.com.pk	/home/inspecta/public_html	inspecta	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.718	2026-02-26 08:11:38.718	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
79ee46d4-b742-4f8d-8ea4-292f98ed1fd4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	itces.org	/home/itcesorg/public_html	itcesorg	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.732	2026-02-26 08:11:38.732	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
662191c0-7ce4-4e4a-a5c0-a1b8d3e287ec	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	itpuff.com	/home/itpuffco/public_html	itpuffco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.745	2026-02-26 08:11:38.745	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
42e46a0a-7ef9-42e1-a873-925e907bce5a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	iuba.ae	/home/iubaae/public_html	iubaae	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.757	2026-02-26 08:11:38.757	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c2b97ced-c6dc-42ea-a414-7b479f546283	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ivadubai.com	/home/ivadubai/public_html	ivadubai	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.77	2026-02-26 08:11:38.77	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
4697af50-dbc4-4005-81e2-43d17f3a9734	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	iwcci.pk	/home/iwccipk/public_html	iwccipk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.783	2026-02-26 08:11:38.783	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
abe5430b-78a0-40ac-bd32-2b70e343965d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	jacketrealleather.com	/home/jacketrealleath/public_html	jacketrealleath	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.795	2026-02-26 08:11:38.795	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
8f297b16-fa82-49b5-9216-5f1d8e0bd00b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	jaguarstripe.com	/home/jaguarst/public_html	jaguarst	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.808	2026-02-26 08:11:38.808	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
4af0d969-1a18-413b-a647-66eb3704e748	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	jamcosports.com	/home/jamcospo/public_html	jamcospo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.822	2026-02-26 08:11:38.822	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
43275866-8edf-40ac-85cf-c3fb3e1d2ed8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	jaragri.com	/home/jaragric/public_html	jaragric	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.834	2026-02-26 08:11:38.834	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
8e55b6c9-badd-4dbe-a511-52ed67d7bdc8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	kaprayonline.com.pk	/home/kaprayon/public_html	kaprayon	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.845	2026-02-26 08:11:38.845	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3ab3e686-e486-4194-b340-fcb0f0858bd4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	kasturivipspa.com	/home/kasturis1/public_html	kasturis1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.857	2026-02-26 08:11:38.857	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3e2efe50-c449-4b3c-960e-053867b2aafc	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	kesarwhite.com	/home/kesarwhi/public_html	kesarwhi	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.868	2026-02-26 08:11:38.868	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
22c23c21-c804-46d9-bf5a-b8f0c0058921	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	keyscommerce.com	/home/keyscomm/public_html	keyscomm	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.879	2026-02-26 08:11:38.879	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
54266318-3851-4b11-b361-4507820f9546	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	kingitsol.com	/home/kingitsol/public_html	kingitsol	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.89	2026-02-26 08:11:38.89	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0ef54479-ff30-4851-b816-a781ed66fdf7	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	lavitas.net	/home/lavitasn/public_html	lavitasn	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.902	2026-02-26 08:11:38.902	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ebfe0d45-2a00-4a7e-98db-5d8f9adbc80e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	learning-curve.pk	/home/learnin8/public_html	learnin8	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.909	2026-02-26 08:11:38.909	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
49131152-182b-45e6-b62d-772c9202e700	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	letsflytogather.com	/home/letsflyt/public_html	letsflyt	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.915	2026-02-26 08:11:38.915	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
237da9a1-334f-4175-a64d-7edac9ff2eb5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	levelupdownloader.com	/home/levelupd/public_html	levelupd	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.922	2026-02-26 08:11:38.922	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
46ccaed0-341a-40d0-a045-b1ccbc26bd6e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	lilacbyrohma.com	/home/lilacby1/public_html	lilacby1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.926	2026-02-26 08:11:38.926	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
20e92808-e8cb-4500-87cb-f4c182cdb1a8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	logcargo.org	/home/logcargo/public_html	logcargo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.931	2026-02-26 08:11:38.931	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d797a6d4-8adf-492c-94e7-bbfd0231c711	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	luxuryexports.net	/home/luxuryex/public_html	luxuryex	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.937	2026-02-26 08:11:38.937	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
48a1289b-65c2-45ff-98d7-9286a5400e0e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	magroenterprises.com	/home/magroent/public_html	magroent	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.941	2026-02-26 08:11:38.941	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
1d5a1ce9-b6a9-4670-8ae5-f30781733d3e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	makeupmaven.pk	/home/makeupma/public_html	makeupma	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.946	2026-02-26 08:11:38.946	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
9456911c-cdb2-4d70-9107-ccb25cbd07a5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	malikfurniture.com	/home/malikfur/public_html	malikfur	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.951	2026-02-26 08:11:38.951	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
2cb2305e-7cc0-4cff-9244-52dea2905783	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	maliktradesllc.com	/home/maliktr2/public_html	maliktr2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.956	2026-02-26 08:11:38.956	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
546cb493-0bc5-4651-88f3-96d25f1eedb1	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mashalmovers.ae	/home/mashalmo/public_html	mashalmo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.961	2026-02-26 08:11:38.961	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
40b8a50c-c014-4a8f-9cd5-c19d9736eec8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	maxar.pk	/home/maxarpk/public_html	maxarpk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.967	2026-02-26 08:11:38.967	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
068c84e8-e825-4a1f-a9cf-6530f105a6c9	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mcm.com.pk	/home/mcmcompk/public_html	mcmcompk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.971	2026-02-26 08:11:38.971	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a43fec14-02c8-4390-8928-fc380a713ed9	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	meatman.pk	/home/meatmanp/public_html	meatmanp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.975	2026-02-26 08:11:38.975	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
df9f34c9-6b23-41e6-bddf-1b620a9a3b11	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mesynergy.org	/home/mesynerg/public_html	mesynerg	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.98	2026-02-26 08:11:38.98	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3c1056cf-0690-4ef7-9656-10467554cc7b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mhaaccounting.com	/home/mhaaccou/public_html	mhaaccou	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.985	2026-02-26 08:11:38.985	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c3a17a14-60ca-41c2-b075-8bc4610881dd	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mic-pa.com	/home/micpacom/public_html	micpacom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.99	2026-02-26 08:11:38.99	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
26f46210-d83f-45ab-a315-588ce2f9c7e2	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mnhfoodnbeverages.com	/home/mnhfoodn/public_html	mnhfoodn	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:38.995	2026-02-26 08:11:38.995	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
fc69a91d-b014-4f87-8ec6-29cddcb9f7a0	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mobicell.net	/home/zeeksglo/public_html	zeeksglo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39	2026-02-26 08:11:39	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
73bd2323-1cc5-46f2-9978-6f265ee0dce8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	modulart.com.pk	/home/modulartcom/public_html	modulartcom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.004	2026-02-26 08:11:39.004	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
01a92974-5c8a-4434-891e-c9ae79e68bf8	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	moheyuddin.com.pk	/home/moheyudd/public_html	moheyudd	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.008	2026-02-26 08:11:39.008	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
47824cec-7417-4ba6-aab9-ce1d5d8aebcc	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	moneyreview.pk	/home/moneyrev/public_html	moneyrev	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.013	2026-02-26 08:11:39.013	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
03f4ccb1-134f-499e-9dfe-0e7743a04a37	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mshop.pk	/home/mshoppk/public_html	mshoppk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.018	2026-02-26 08:11:39.018	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
823b360f-d9a7-4e41-bfcf-dcec6d62a5f2	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	muasasataleanizan.com	/home/muasasat/public_html	muasasat	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.022	2026-02-26 08:11:39.022	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7af5ad9a-0106-4891-84d9-767c1145d0dd	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	mujawharat.com.pk	/home/mujawhar/public_html	mujawhar	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.027	2026-02-26 08:11:39.027	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f13be53c-1534-459e-9e54-079c8dc169e3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	multisupportengineering.com	/home/multisup/public_html	multisup	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.033	2026-02-26 08:11:39.033	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ca0a993d-e314-4c75-b099-0596cee73000	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	nainagbeautysalon.com	/home/nainagbe/public_html	nainagbe	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.039	2026-02-26 08:11:39.039	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f09b9c75-5e77-47e6-9fe8-aa9d407dfb1a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	naveedautomobiles.com.pk	/home/naveedau/public_html	naveedau	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.046	2026-02-26 08:11:39.046	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
1351eeb4-41b9-449e-8658-92f679f8ee06	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	neuronixtech.com	/home/neuronix/public_html	neuronix	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.052	2026-02-26 08:11:39.052	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
808097ce-ddff-4dc8-9fb4-6050740c51cc	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	nexwear.pk	/home/nexwearp/public_html	nexwearp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.058	2026-02-26 08:11:39.058	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
82a9e21a-4cc2-4797-8d7c-26a930edceb7	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ofeni.xyz	/home/ofenixyz/public_html	ofenixyz	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.064	2026-02-26 08:11:39.064	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
dc6a7e98-de8d-4eee-8333-efaa84c420cc	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	orjaneek.com	/home/orjaneek/public_html	orjaneek	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.069	2026-02-26 08:11:39.069	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b535fc10-043f-4cdc-a7a9-9d5099ad9c77	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	orthodocnews.com	/home/orthodoc/public_html	orthodoc	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.074	2026-02-26 08:11:39.074	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
776fadcb-d4e4-41db-8d18-abbb08194145	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	oshacenter.us	/home/oshacent/public_html	oshacent	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.079	2026-02-26 08:11:39.079	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e474c83c-5f37-4e40-997f-704837a3bcd5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	outdoorsolutions.pk	/home/outdoor2/public_html	outdoor2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.084	2026-02-26 08:11:39.084	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
15bb1546-b7cf-4f70-8529-5d60f52d7839	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	oxnutrition.pk	/home/oxnutri1/public_html	oxnutri1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.089	2026-02-26 08:11:39.089	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
cd84e47e-4d7f-4f4f-95b7-7e963c1475f9	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pakcec.com	/home/pakcecco/public_html	pakcecco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.093	2026-02-26 08:11:39.093	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ebb587a3-2b6e-46e5-85a3-32a247f8093c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pakistanbatterytraders.pk	/home/pakist17/public_html	pakist17	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.098	2026-02-26 08:11:39.098	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a297b8ca-7acf-4cfb-8633-41f116b96e6a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pakplas.com.pk	/home/pakplasc/public_html	pakplasc	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.102	2026-02-26 08:11:39.102	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ff1dffd8-2f78-44b5-bd68-88d2d6ac412b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	patialajeweller.com	/home/patialaj/public_html	patialaj	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.106	2026-02-26 08:11:39.106	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e5ff3e95-a3da-4b23-9078-9ec56feb5015	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pcbf1.com	/home/pcbfcom/public_html	pcbfcom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.111	2026-02-26 08:11:39.111	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a1b611cd-0131-4116-9c9c-b7caefa1754b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	peipk.com	/home/peipkcom/public_html	peipkcom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.115	2026-02-26 08:11:39.115	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ed2027c8-9af4-4398-990b-ba99b16c9075	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pharma-sol.com	/home/pharmaso/public_html	pharmaso	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.12	2026-02-26 08:11:39.12	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5a0229ba-c9eb-4064-a8ec-79bf5bc07e49	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	planetofcoders.com	/home/estrelas/public_html	estrelas	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.123	2026-02-26 08:11:39.123	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d318f546-f608-4fd8-8f0a-33b97d83cf14	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pmu-lgcdd.gop.pk	/home/pmulgcdd/public_html	pmulgcdd	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.127	2026-02-26 08:11:39.127	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
8f1b8dd0-fd6a-4a94-996d-a1141b271807	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	polarisglobaltextile.com	/home/polarisg/public_html	polarisg	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.131	2026-02-26 08:11:39.131	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
22a15ac9-39c1-4fa0-a393-fbb687395724	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	pqamcl.com	/home/pqamclco/public_html	pqamclco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.136	2026-02-26 08:11:39.136	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
040bfe90-ee70-402a-b2b6-9367f6cc1f60	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	productpackagings.com	/home/productp/public_html	productp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.14	2026-02-26 08:11:39.14	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b958eea4-5020-411f-b3c3-abb06b20fa61	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	promptsaga.com	/home/promptsa/public_html	promptsa	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.143	2026-02-26 08:11:39.143	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7429b6bb-3f3b-4046-8025-febda8d8e2b5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	protonicnutrition.pk	/home/protonic/public_html	protonic	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.148	2026-02-26 08:11:39.148	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
231eed99-3a65-46be-b85a-28f853d528b9	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	quantomshop.com	/home/quantoms/public_html	quantoms	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.153	2026-02-26 08:11:39.153	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e904acb6-6657-4ea5-a354-0f63e70384f4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	quiklinkgroup.com	/home/quiklink/public_html	quiklink	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.157	2026-02-26 08:11:39.157	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e66fedfb-e285-4918-8def-620dd7a963e4	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	quresheeinc.com	/home/qureshee/public_html	qureshee	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.161	2026-02-26 08:11:39.161	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c64a699a-9bdb-4afb-91f4-0b7500bcc928	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	rayanfabrics.com	/home/rayanfa2/public_html	rayanfa2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.166	2026-02-26 08:11:39.166	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
59621d8c-0d12-42f8-b3e7-38cbc9af3552	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	readprowrite.com	/home/readprow/public_html	readprow	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.17	2026-02-26 08:11:39.17	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d512f11c-b2d3-46c8-80cc-a04704561ed0	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	reckonsphere.com	/home/reckonsp/public_html	reckonsp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.173	2026-02-26 08:11:39.173	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b3dbd247-52f8-412f-9c17-afa0f583afcf	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	rehbarfoundation.org	/home/rehbarfo/public_html	rehbarfo	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.177	2026-02-26 08:11:39.177	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7f8910b6-6b9d-4703-ab06-5f25eef77c00	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	relyxdigital.com	/home/quantixl/public_html	quantixl	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.183	2026-02-26 08:11:39.183	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
dac762c3-b698-46c6-8a5f-8c049f45844b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	researcherpoint.com	/home/researc3/public_html	researc3	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.186	2026-02-26 08:11:39.186	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
cb464be8-36a1-4ec6-9838-d5b2886fc87d	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	reshamfabrics.pk	/home/reshamfa/public_html	reshamfa	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.19	2026-02-26 08:11:39.19	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
74dbc130-9126-4b45-8a2e-ea1cf4303e86	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	rightprofessionals.co	/home/rightpro/public_html	rightpro	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.194	2026-02-26 08:11:39.194	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5adc97b2-bef4-4479-a780-dd0c7434b342	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	rihlainstitute.com	/home/rihlains/public_html	rihlains	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.199	2026-02-26 08:11:39.199	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
723ae12b-e41e-4f1b-8c1a-04d10165b105	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	rmur.edu.pk	/home/cmsrmure/public_html	cmsrmure	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.203	2026-02-26 08:11:39.203	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f9c2255d-664b-4cb6-a805-fb22f924be46	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	saifespl.com	/home/saifespl/public_html	saifespl	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.207	2026-02-26 08:11:39.207	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
163e60e6-9ca5-4861-bb2a-9086e0a0c0cd	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	salgirah.pk	/home/salgir/public_html	salgir	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.211	2026-02-26 08:11:39.211	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0da7dd6b-7307-4640-ba8e-aa02ab3bbeb3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	sareewalay.com	/home/sareewal/public_html	sareewal	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.215	2026-02-26 08:11:39.215	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b2f09762-6f00-458a-b747-c75b515926d5	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	seriesofwords.com.pk	/home/seriesof/public_html	seriesof	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.219	2026-02-26 08:11:39.219	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ef2e389f-d758-40e5-be88-beed61c16439	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	shobi10x.com	/home/shobixco/public_html	shobixco	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.223	2026-02-26 08:11:39.223	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
014e7636-0058-4a7c-bea5-6fe14bf0b968	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	shop02.uk	/home/shopuk1/public_html	shopuk1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.227	2026-02-26 08:11:39.227	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
160742bc-6ab9-4a65-8986-72208fdc117e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	shopse.pk	/home/shopse2/public_html	shopse2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.231	2026-02-26 08:11:39.231	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
55078e4b-0936-4acc-87e5-6ab0b62f8d79	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	siglobalco.com	/home/siglobal/public_html	siglobal	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.235	2026-02-26 08:11:39.235	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
6aedf1ce-3596-431d-853d-253be40106e9	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	signatureflower.ae	/home/signatu2/public_html	signatu2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.239	2026-02-26 08:11:39.239	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
fc555228-61f0-44b2-8c9c-cfdca85f124c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	skydreammers.com	/home/skydream/public_html	skydream	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.243	2026-02-26 08:11:39.243	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
39c07e0c-7708-449e-b549-56c4ac7198dd	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	smdc.pk	/home/smdcpk/public_html	smdcpk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.247	2026-02-26 08:11:39.247	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e2b6d0f2-6ebf-494d-9504-3a2ad632cf88	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	smt.net.pk	/home/smtnetpk/public_html	smtnetpk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.251	2026-02-26 08:11:39.251	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7cbfec41-7c43-4cdd-96ad-66bdc3204ec3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	sohailelectronics.com	/home/sohailel/public_html	sohailel	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.255	2026-02-26 08:11:39.255	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5e7a53f1-c8fc-4e2c-b7d9-41b874278650	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	solarislamabad.pk	/home/solarisl/public_html	solarisl	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.258	2026-02-26 08:11:39.258	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0495a852-bcba-40ab-aa2a-6306cab55356	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	souqsundus.com	/home/souqsund/public_html	souqsund	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.263	2026-02-26 08:11:39.263	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
986573d7-3bf8-46ed-9d1f-7948e660535a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	sparktechnology.pk	/home/sparkte1/public_html	sparkte1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.267	2026-02-26 08:11:39.267	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ebbe4876-1bef-4e73-846b-1fc99e548f7e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	spluss.ca	/home/splussca/public_html	splussca	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.271	2026-02-26 08:11:39.271	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d11b9d5e-bc88-49c1-8a9d-6218ef34df7e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	statelife.org.pk	/home/stateli2/public_html	stateli2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.274	2026-02-26 08:11:39.274	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
682ea061-e2bd-47b6-99a4-90fb05ee0374	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	stnglobal.net	/home/stngloba/public_html	stngloba	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.279	2026-02-26 08:11:39.279	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
2da92e98-8d91-4c2e-957a-82218e9c4974	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	stokecarsltd.com	/home/stokeca1/public_html	stokeca1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.283	2026-02-26 08:11:39.283	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
d012bf6b-6e22-4e9d-b7bc-45a8461f4d22	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	sultaan.pk	/home/helpingh/public_html	helpingh	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.286	2026-02-26 08:11:39.286	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
f34438d9-1f16-4a4f-97b9-9db02cb69b89	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	talkshawk.net	/home/talkshaw/public_html	talkshaw	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.29	2026-02-26 08:11:39.29	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
a1d72380-cf61-4d88-8ffb-b3de3134cc29	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	tanveerhospital.pk	/home/tanveerh/public_html	tanveerh	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.293	2026-02-26 08:11:39.293	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
903f3431-17a0-44bc-8eda-a63f5c8ae42b	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	tanveeriqballawfirm.com	/home/tanveeri/public_html	tanveeri	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.298	2026-02-26 08:11:39.298	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
bdbc72d6-b049-4081-8864-4427590b8503	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	tauheedinternational.com	/home/tauheedi/public_html	tauheedi	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.302	2026-02-26 08:11:39.302	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b980cb19-2ad3-4187-8c66-100720e6d565	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	teatimepoetry.com	/home/teatimep/public_html	teatimep	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.306	2026-02-26 08:11:39.306	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
07466687-21a7-42c2-80bd-99f5da28badd	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	tech-nodes.com	/home/technode/public_html	technode	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.31	2026-02-26 08:11:39.31	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e811e474-f2b1-4843-b1f7-b10da697abcb	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	techguys.pk	/home/techguys/public_html	techguys	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.315	2026-02-26 08:11:39.315	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0de8125a-c002-48e6-98f7-27b8dcfe4256	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	technovation.pk	/home/technova/public_html	technova	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.32	2026-02-26 08:11:39.32	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
067a29a5-4895-438d-ae2c-8e29b859a295	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	texasquickfunding.com	/home/texasqui/public_html	texasqui	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.324	2026-02-26 08:11:39.324	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
6165d926-c6da-45a2-8da7-50a673ccbe7c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	thecreatex.com	/home/thecreat/public_html	thecreat	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.328	2026-02-26 08:11:39.328	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
03b8a0a6-f782-4364-a506-56b627b2bd9c	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	theonlineera.com.pk	/home/theonli2/public_html	theonli2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.333	2026-02-26 08:11:39.333	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e59ef3d8-f4fd-4a0e-ba7d-0a6af50cc485	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	theroyalarts.com	/home/theroya5/public_html	theroya5	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.336	2026-02-26 08:11:39.336	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
3c8b578c-61e9-4e11-8214-ac10e2bde545	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	timeandstyle.pk	/home/timeands/public_html	timeands	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.34	2026-02-26 08:11:39.34	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
20597790-aadb-4681-89d3-0b3ade5cf6a3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	timpexdecor.com	/home/timpexde/public_html	timpexde	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.345	2026-02-26 08:11:39.345	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
c8b52dcb-90ef-42ee-9689-eab11b90633a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	toyotamandimotors.com	/home/toyotam1/public_html	toyotam1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.349	2026-02-26 08:11:39.349	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
b9aa57ed-139b-4852-919b-8e24b2be9180	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	tranzverse.net	/home/tranzver/public_html	tranzver	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.353	2026-02-26 08:11:39.353	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
801a815d-d6e2-4b8e-a9f0-75dc769cdc25	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	unvcctvshowroom.shop	/home/unvcctvs/public_html	unvcctvs	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.358	2026-02-26 08:11:39.358	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0d0202f9-c3f5-41da-ac11-5e04f0a0b6ba	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	uptownshop.pk	/home/uptownsh/public_html	uptownsh	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.362	2026-02-26 08:11:39.362	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7774d284-8232-487e-8546-fe4e93b7418a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	urdupublisher.com	/home/urdupubl/public_html	urdupubl	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.367	2026-02-26 08:11:39.367	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
8fbb9211-a10a-43a3-98da-64ca35f8e3ab	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	uslshipping.com	/home/uslship1/public_html	uslship1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.371	2026-02-26 08:11:39.371	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
108a5543-c935-4bb1-90e7-1b1d265e1f5a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	veerjee.shop	/home/veerjees/public_html	veerjees	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.379	2026-02-26 08:11:39.379	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0cbbd1e6-75d7-4536-8023-58538c82f745	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	ventemagazine.com	/home/ventemag/public_html	ventemag	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.384	2026-02-26 08:11:39.384	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e699998c-8781-4f8e-a1dd-ee5794cec1bc	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	vertex3d.co	/home/etronics/public_html	etronics	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.388	2026-02-26 08:11:39.388	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
1f6806d0-0c35-43d1-80ce-6dc2702ccd54	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	vvsconsultants.pk	/home/vvsconsu/public_html	vvsconsu	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.392	2026-02-26 08:11:39.392	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
92b291c3-d1c3-4bcd-bf7f-b9923819364e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	watchman.com.pk	/home/watchman/public_html	watchman	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.396	2026-02-26 08:11:39.396	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
56b5f5c4-9f66-48ba-8968-86bacc542f51	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	we.com.pk	/home/wecom/public_html	wecom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.401	2026-02-26 08:11:39.401	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
5200862d-dee3-41d5-9b23-8812bd426e6a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	websolspro.com	/home/websolsp/public_html	websolsp	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.405	2026-02-26 08:11:39.405	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
521908ef-f54f-408a-a5cb-6b91bb667b73	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	welwrdpharmaceuticals.com	/home/welwrdph/public_html	welwrdph	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.409	2026-02-26 08:11:39.409	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
7c4ac906-b21a-4bf2-8511-716df929839e	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	wesglor.pk	/home/wesglor1/public_html	wesglor1	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.413	2026-02-26 08:11:39.413	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
0b2d30f3-a90b-49df-a9b3-4892f2790c70	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	wetrip.pk	/home/wetrippk/public_html	wetrippk	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.417	2026-02-26 08:11:39.417	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
e55f8544-29ec-4e54-96dc-33d568279061	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	yamasfurniture.com	/home/yamasfur/public_html	yamasfur	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.421	2026-02-26 08:11:39.421	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
58c41661-e4f0-4f1c-850b-cb0ead6eb810	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	z-engr.com	/home/zengrcom/public_html	zengrcom	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.424	2026-02-26 08:11:39.424	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
264b7ca3-4ebc-4dd8-9e6e-6d30bb53acc3	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	zarwatech.com.pk	/home/zarwate2/public_html	zarwate2	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.428	2026-02-26 08:11:39.428	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
ad044aaf-92e8-4253-aa8d-c856b5088d2a	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	zeewebtech.com	/home/zeewebte/public_html	zeewebte	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.433	2026-02-26 08:11:39.433	\N	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
2c6846f9-1747-4ad3-9e2d-928dde4daa82	1627c6b4-6f30-4606-a5b7-7717c9ba8be3	uzairfarooq.pk	/home/x98aailqrs/public_html	x98aailqrs	\N	\N	\N	localhost	MANUAL	f	3	15	{woocommerce,woocommerce-*}	\N	UNKNOWN	\N	\N	\N	\N	0	\N	2026-02-26 08:11:39.375	2026-02-26 08:11:51.74	[{"path": "/home/x98aailqrs/public_html/testing", "type": "subdomain", "subdomain": "testing.uzairfarooq.pk", "hasWordPress": true}]	\N	CLOSED	0	\N	3	5000	EXPONENTIAL
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: diagnosis_cache diagnosis_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.diagnosis_cache
    ADD CONSTRAINT diagnosis_cache_pkey PRIMARY KEY (id);


--
-- Name: diagnosis_history diagnosis_history_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.diagnosis_history
    ADD CONSTRAINT diagnosis_history_pkey PRIMARY KEY (id);


--
-- Name: email_history email_history_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.email_history
    ADD CONSTRAINT email_history_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: healer_alerts healer_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_alerts
    ADD CONSTRAINT healer_alerts_pkey PRIMARY KEY (id);


--
-- Name: healer_audit_logs healer_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_audit_logs
    ADD CONSTRAINT healer_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: healer_backups healer_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_backups
    ADD CONSTRAINT healer_backups_pkey PRIMARY KEY (id);


--
-- Name: healer_executions healer_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_executions
    ADD CONSTRAINT healer_executions_pkey PRIMARY KEY (id);


--
-- Name: healer_metrics healer_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_metrics
    ADD CONSTRAINT healer_metrics_pkey PRIMARY KEY (id);


--
-- Name: healing_action_logs healing_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_action_logs
    ADD CONSTRAINT healing_action_logs_pkey PRIMARY KEY (id);


--
-- Name: healing_patterns healing_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_patterns
    ADD CONSTRAINT healing_patterns_pkey PRIMARY KEY (id);


--
-- Name: healing_workflows healing_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_workflows
    ADD CONSTRAINT healing_workflows_pkey PRIMARY KEY (id);


--
-- Name: health_score_history health_score_history_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.health_score_history
    ADD CONSTRAINT health_score_history_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: manual_diagnosis_sessions manual_diagnosis_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.manual_diagnosis_sessions
    ADD CONSTRAINT manual_diagnosis_sessions_pkey PRIMARY KEY (id);


--
-- Name: notification_rules notification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: scheduled_diagnosis scheduled_diagnosis_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.scheduled_diagnosis
    ADD CONSTRAINT scheduled_diagnosis_pkey PRIMARY KEY (id);


--
-- Name: server_metrics server_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.server_metrics
    ADD CONSTRAINT server_metrics_pkey PRIMARY KEY (id);


--
-- Name: server_test_history server_test_history_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.server_test_history
    ADD CONSTRAINT server_test_history_pkey PRIMARY KEY (id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: wp_sites wp_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.wp_sites
    ADD CONSTRAINT wp_sites_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_resource_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX audit_logs_resource_idx ON public.audit_logs USING btree (resource);


--
-- Name: audit_logs_severity_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX audit_logs_severity_idx ON public.audit_logs USING btree (severity);


--
-- Name: audit_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs USING btree ("timestamp");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: diagnosis_cache_expiresAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "diagnosis_cache_expiresAt_idx" ON public.diagnosis_cache USING btree ("expiresAt");


--
-- Name: diagnosis_cache_serverId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "diagnosis_cache_serverId_idx" ON public.diagnosis_cache USING btree ("serverId");


--
-- Name: diagnosis_cache_serverId_sitePath_domain_profile_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX "diagnosis_cache_serverId_sitePath_domain_profile_key" ON public.diagnosis_cache USING btree ("serverId", "sitePath", domain, profile);


--
-- Name: diagnosis_history_createdAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "diagnosis_history_createdAt_idx" ON public.diagnosis_history USING btree ("createdAt");


--
-- Name: diagnosis_history_healthScore_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "diagnosis_history_healthScore_idx" ON public.diagnosis_history USING btree ("healthScore");


--
-- Name: diagnosis_history_profile_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX diagnosis_history_profile_idx ON public.diagnosis_history USING btree (profile);


--
-- Name: diagnosis_history_siteId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "diagnosis_history_siteId_idx" ON public.diagnosis_history USING btree ("siteId");


--
-- Name: email_history_createdAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "email_history_createdAt_idx" ON public.email_history USING btree ("createdAt");


--
-- Name: email_history_ruleId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "email_history_ruleId_idx" ON public.email_history USING btree ("ruleId");


--
-- Name: email_history_status_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX email_history_status_idx ON public.email_history USING btree (status);


--
-- Name: email_history_triggerEvent_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "email_history_triggerEvent_idx" ON public.email_history USING btree ("triggerEvent");


--
-- Name: email_history_triggeredBy_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "email_history_triggeredBy_idx" ON public.email_history USING btree ("triggeredBy");


--
-- Name: email_templates_key_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX email_templates_key_idx ON public.email_templates USING btree (key);


--
-- Name: email_templates_key_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX email_templates_key_key ON public.email_templates USING btree (key);


--
-- Name: healer_alerts_alertType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_alerts_alertType_idx" ON public.healer_alerts USING btree ("alertType");


--
-- Name: healer_alerts_createdAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_alerts_createdAt_idx" ON public.healer_alerts USING btree ("createdAt");


--
-- Name: healer_alerts_status_severity_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healer_alerts_status_severity_idx ON public.healer_alerts USING btree (status, severity);


--
-- Name: healer_audit_logs_action_timestamp_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healer_audit_logs_action_timestamp_idx ON public.healer_audit_logs USING btree (action, "timestamp");


--
-- Name: healer_audit_logs_siteId_timestamp_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_audit_logs_siteId_timestamp_idx" ON public.healer_audit_logs USING btree ("siteId", "timestamp");


--
-- Name: healer_audit_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healer_audit_logs_timestamp_idx ON public.healer_audit_logs USING btree ("timestamp");


--
-- Name: healer_audit_logs_userId_timestamp_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_audit_logs_userId_timestamp_idx" ON public.healer_audit_logs USING btree ("userId", "timestamp");


--
-- Name: healer_backups_expiresAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_backups_expiresAt_idx" ON public.healer_backups USING btree ("expiresAt");


--
-- Name: healer_backups_siteId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_backups_siteId_idx" ON public.healer_backups USING btree ("siteId");


--
-- Name: healer_backups_status_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healer_backups_status_idx ON public.healer_backups USING btree (status);


--
-- Name: healer_executions_diagnosisType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_executions_diagnosisType_idx" ON public.healer_executions USING btree ("diagnosisType");


--
-- Name: healer_executions_siteId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_executions_siteId_idx" ON public.healer_executions USING btree ("siteId");


--
-- Name: healer_executions_startedAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_executions_startedAt_idx" ON public.healer_executions USING btree ("startedAt");


--
-- Name: healer_executions_status_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healer_executions_status_idx ON public.healer_executions USING btree (status);


--
-- Name: healer_executions_trigger_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healer_executions_trigger_idx ON public.healer_executions USING btree (trigger);


--
-- Name: healer_metrics_periodStart_periodType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_metrics_periodStart_periodType_idx" ON public.healer_metrics USING btree ("periodStart", "periodType");


--
-- Name: healer_metrics_periodType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healer_metrics_periodType_idx" ON public.healer_metrics USING btree ("periodType");


--
-- Name: healing_action_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healing_action_logs_createdAt_idx" ON public.healing_action_logs USING btree ("createdAt");


--
-- Name: healing_action_logs_executionId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healing_action_logs_executionId_idx" ON public.healing_action_logs USING btree ("executionId");


--
-- Name: healing_action_logs_siteId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healing_action_logs_siteId_idx" ON public.healing_action_logs USING btree ("siteId");


--
-- Name: healing_action_logs_status_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healing_action_logs_status_idx ON public.healing_action_logs USING btree (status);


--
-- Name: healing_patterns_autoApproved_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healing_patterns_autoApproved_idx" ON public.healing_patterns USING btree ("autoApproved");


--
-- Name: healing_patterns_confidence_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healing_patterns_confidence_idx ON public.healing_patterns USING btree (confidence);


--
-- Name: healing_patterns_diagnosisType_errorType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healing_patterns_diagnosisType_errorType_idx" ON public.healing_patterns USING btree ("diagnosisType", "errorType");


--
-- Name: healing_patterns_verified_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healing_patterns_verified_idx ON public.healing_patterns USING btree (verified);


--
-- Name: healing_workflows_siteId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "healing_workflows_siteId_idx" ON public.healing_workflows USING btree ("siteId");


--
-- Name: healing_workflows_status_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX healing_workflows_status_idx ON public.healing_workflows USING btree (status);


--
-- Name: health_score_history_siteId_createdAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "health_score_history_siteId_createdAt_idx" ON public.health_score_history USING btree ("siteId", "createdAt");


--
-- Name: integrations_createdByUserId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "integrations_createdByUserId_idx" ON public.integrations USING btree ("createdByUserId");


--
-- Name: integrations_healthStatus_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "integrations_healthStatus_idx" ON public.integrations USING btree ("healthStatus");


--
-- Name: integrations_isActive_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "integrations_isActive_idx" ON public.integrations USING btree ("isActive");


--
-- Name: integrations_linkedServerId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "integrations_linkedServerId_idx" ON public.integrations USING btree ("linkedServerId");


--
-- Name: integrations_provider_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX integrations_provider_idx ON public.integrations USING btree (provider);


--
-- Name: manual_diagnosis_sessions_siteId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "manual_diagnosis_sessions_siteId_idx" ON public.manual_diagnosis_sessions USING btree ("siteId");


--
-- Name: manual_diagnosis_sessions_status_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX manual_diagnosis_sessions_status_idx ON public.manual_diagnosis_sessions USING btree (status);


--
-- Name: notification_rules_isActive_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "notification_rules_isActive_idx" ON public.notification_rules USING btree ("isActive");


--
-- Name: notification_rules_priority_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX notification_rules_priority_idx ON public.notification_rules USING btree (priority);


--
-- Name: notification_rules_trigger_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX notification_rules_trigger_idx ON public.notification_rules USING btree (trigger);


--
-- Name: password_reset_tokens_expiresAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "password_reset_tokens_expiresAt_idx" ON public.password_reset_tokens USING btree ("expiresAt");


--
-- Name: password_reset_tokens_tokenHash_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "password_reset_tokens_tokenHash_idx" ON public.password_reset_tokens USING btree ("tokenHash");


--
-- Name: password_reset_tokens_tokenHash_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON public.password_reset_tokens USING btree ("tokenHash");


--
-- Name: password_reset_tokens_userId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "password_reset_tokens_userId_idx" ON public.password_reset_tokens USING btree ("userId");


--
-- Name: permissions_roleId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "permissions_roleId_idx" ON public.permissions USING btree ("roleId");


--
-- Name: permissions_roleId_resource_action_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX "permissions_roleId_resource_action_key" ON public.permissions USING btree ("roleId", resource, action);


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: scheduled_diagnosis_enabled_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX scheduled_diagnosis_enabled_idx ON public.scheduled_diagnosis USING btree (enabled);


--
-- Name: scheduled_diagnosis_nextRunAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "scheduled_diagnosis_nextRunAt_idx" ON public.scheduled_diagnosis USING btree ("nextRunAt");


--
-- Name: scheduled_diagnosis_siteId_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX "scheduled_diagnosis_siteId_key" ON public.scheduled_diagnosis USING btree ("siteId");


--
-- Name: server_metrics_collectedAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "server_metrics_collectedAt_idx" ON public.server_metrics USING btree ("collectedAt");


--
-- Name: server_metrics_serverId_collectedAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "server_metrics_serverId_collectedAt_idx" ON public.server_metrics USING btree ("serverId", "collectedAt");


--
-- Name: server_test_history_serverId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "server_test_history_serverId_idx" ON public.server_test_history USING btree ("serverId");


--
-- Name: server_test_history_testedAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "server_test_history_testedAt_idx" ON public.server_test_history USING btree ("testedAt");


--
-- Name: server_test_history_triggeredByUserId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "server_test_history_triggeredByUserId_idx" ON public.server_test_history USING btree ("triggeredByUserId");


--
-- Name: servers_createdByUserId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "servers_createdByUserId_idx" ON public.servers USING btree ("createdByUserId");


--
-- Name: servers_deletedAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "servers_deletedAt_idx" ON public.servers USING btree ("deletedAt");


--
-- Name: servers_environment_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX servers_environment_idx ON public.servers USING btree (environment);


--
-- Name: servers_host_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX servers_host_idx ON public.servers USING btree (host);


--
-- Name: servers_lastTestStatus_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "servers_lastTestStatus_idx" ON public.servers USING btree ("lastTestStatus");


--
-- Name: servers_metricsEnabled_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "servers_metricsEnabled_idx" ON public.servers USING btree ("metricsEnabled");


--
-- Name: servers_name_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX servers_name_idx ON public.servers USING btree (name);


--
-- Name: servers_platformType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "servers_platformType_idx" ON public.servers USING btree ("platformType");


--
-- Name: sessions_expiresAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "sessions_expiresAt_idx" ON public.sessions USING btree ("expiresAt");


--
-- Name: sessions_refreshToken_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "sessions_refreshToken_idx" ON public.sessions USING btree ("refreshToken");


--
-- Name: sessions_refreshToken_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX "sessions_refreshToken_key" ON public.sessions USING btree ("refreshToken");


--
-- Name: sessions_token_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX sessions_token_idx ON public.sessions USING btree (token);


--
-- Name: sessions_token_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX sessions_token_key ON public.sessions USING btree (token);


--
-- Name: sessions_userId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "sessions_userId_idx" ON public.sessions USING btree ("userId");


--
-- Name: settings_key_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX settings_key_idx ON public.settings USING btree (key);


--
-- Name: settings_key_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX settings_key_key ON public.settings USING btree (key);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_isActive_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "users_isActive_idx" ON public.users USING btree ("isActive");


--
-- Name: users_roleId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "users_roleId_idx" ON public.users USING btree ("roleId");


--
-- Name: users_username_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX users_username_idx ON public.users USING btree (username);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: webhook_events_eventType_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "webhook_events_eventType_idx" ON public.webhook_events USING btree ("eventType");


--
-- Name: webhook_events_integrationId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "webhook_events_integrationId_idx" ON public.webhook_events USING btree ("integrationId");


--
-- Name: webhook_events_processed_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX webhook_events_processed_idx ON public.webhook_events USING btree (processed);


--
-- Name: webhook_events_receivedAt_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "webhook_events_receivedAt_idx" ON public.webhook_events USING btree ("receivedAt");


--
-- Name: wp_sites_circuitBreakerState_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "wp_sites_circuitBreakerState_idx" ON public.wp_sites USING btree ("circuitBreakerState");


--
-- Name: wp_sites_domain_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX wp_sites_domain_idx ON public.wp_sites USING btree (domain);


--
-- Name: wp_sites_domain_key; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE UNIQUE INDEX wp_sites_domain_key ON public.wp_sites USING btree (domain);


--
-- Name: wp_sites_healthStatus_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "wp_sites_healthStatus_idx" ON public.wp_sites USING btree ("healthStatus");


--
-- Name: wp_sites_isHealerEnabled_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "wp_sites_isHealerEnabled_idx" ON public.wp_sites USING btree ("isHealerEnabled");


--
-- Name: wp_sites_serverId_idx; Type: INDEX; Schema: public; Owner: opsmanager
--

CREATE INDEX "wp_sites_serverId_idx" ON public.wp_sites USING btree ("serverId");


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: diagnosis_history diagnosis_history_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.diagnosis_history
    ADD CONSTRAINT "diagnosis_history_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_history email_history_ruleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.email_history
    ADD CONSTRAINT "email_history_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES public.notification_rules(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: healer_backups healer_backups_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_backups
    ADD CONSTRAINT "healer_backups_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: healer_executions healer_executions_backupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_executions
    ADD CONSTRAINT "healer_executions_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES public.healer_backups(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: healer_executions healer_executions_previousAttemptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_executions
    ADD CONSTRAINT "healer_executions_previousAttemptId_fkey" FOREIGN KEY ("previousAttemptId") REFERENCES public.healer_executions(id) ON DELETE SET NULL;


--
-- Name: healer_executions healer_executions_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healer_executions
    ADD CONSTRAINT "healer_executions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: healing_action_logs healing_action_logs_backupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_action_logs
    ADD CONSTRAINT "healing_action_logs_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES public.healer_backups(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: healing_action_logs healing_action_logs_executionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_action_logs
    ADD CONSTRAINT "healing_action_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES public.healer_executions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: healing_action_logs healing_action_logs_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_action_logs
    ADD CONSTRAINT "healing_action_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: healing_workflows healing_workflows_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.healing_workflows
    ADD CONSTRAINT "healing_workflows_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: health_score_history health_score_history_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.health_score_history
    ADD CONSTRAINT "health_score_history_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: integrations integrations_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "integrations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: integrations integrations_linkedServerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT "integrations_linkedServerId_fkey" FOREIGN KEY ("linkedServerId") REFERENCES public.servers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: manual_diagnosis_sessions manual_diagnosis_sessions_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.manual_diagnosis_sessions
    ADD CONSTRAINT "manual_diagnosis_sessions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: permissions permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scheduled_diagnosis scheduled_diagnosis_siteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.scheduled_diagnosis
    ADD CONSTRAINT "scheduled_diagnosis_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES public.wp_sites(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: server_metrics server_metrics_serverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.server_metrics
    ADD CONSTRAINT "server_metrics_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES public.servers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: server_test_history server_test_history_serverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.server_test_history
    ADD CONSTRAINT "server_test_history_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES public.servers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: server_test_history server_test_history_triggeredByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.server_test_history
    ADD CONSTRAINT "server_test_history_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: servers servers_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT "servers_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: webhook_events webhook_events_integrationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT "webhook_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES public.integrations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wp_sites wp_sites_serverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: opsmanager
--

ALTER TABLE ONLY public.wp_sites
    ADD CONSTRAINT "wp_sites_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES public.servers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 7wWhD2bU9cNWZRAhRrOYWdzBBYVB5YlPgTEvK5kNdU3qlW581dofyWFg2RIDw9c

