export type PlatformType = 'LINUX' | 'WINDOWS';
export type AuthType = 'SSH_KEY' | 'SSH_KEY_WITH_PASSPHRASE' | 'PASSWORD';
export type PrivilegeMode = 'ROOT' | 'SUDO' | 'USER_ONLY';
export type SudoMode = 'NONE' | 'NOPASSWD' | 'PASSWORD_REQUIRED';
export type HostKeyStrategy = 'STRICT_PINNED' | 'TOFU' | 'DISABLED';
export type TestStatus = 'NEVER_TESTED' | 'OK' | 'FAILED';

export interface HostKeyFingerprint {
  keyType: string;
  fingerprint: string;
  firstSeenAt?: string;
  lastVerifiedAt?: string;
}

export interface ServerCredentials {
  privateKey?: string;
  passphrase?: string;
  password?: string;
}

export interface Server {
  id: string;
  name: string;
  environment: string | null;
  tags: string[];
  notes: string | null;
  platformType: PlatformType;
  host: string;
  port: number;
  connectionProtocol: string;
  username: string;
  authType: AuthType;
  privilegeMode: PrivilegeMode;
  sudoMode: SudoMode;
  hostKeyStrategy: HostKeyStrategy;
  knownHostFingerprints: HostKeyFingerprint[];
  lastTestStatus: TestStatus;
  lastTestAt: string | null;
  lastTestResult: ConnectionTestResult | null;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  hasPassword: boolean;
  hasSudoPassword: boolean;
  metricsEnabled?: boolean;
  metricsInterval?: number;
  alertCpuThreshold?: number;
  alertRamThreshold?: number;
  alertDiskThreshold?: number;
  createdByUserId: string;
  createdBy: {
    id: string;
    email: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency: number;
  testedAt: string;
  details: {
    dnsResolution: {
      success: boolean;
      ip?: string;
      time: number;
      error?: string;
    };
    tcpConnection: {
      success: boolean;
      time: number;
      error?: string;
    };
    hostKeyVerification: {
      success: boolean;
      keyType?: string;
      fingerprint?: string;
      fingerprintMD5?: string;
      matched?: boolean;
      error?: string;
    };
    authentication: {
      success: boolean;
      time: number;
      error?: string;
    };
    privilegeTest: {
      success: boolean;
      hasRoot?: boolean;
      hasSudo?: boolean;
      error?: string;
    };
    commandExecution: {
      whoami?: {
        success: boolean;
        output?: string;
        error?: string;
      };
      systemInfo?: {
        success: boolean;
        output?: string;
        error?: string;
      };
      customCommands?: Array<{
        command: string;
        success: boolean;
        output?: string;
        error?: string;
      }>;
    };
  };
  detectedOS?: string;
  detectedUsername?: string;
  errors: string[];
  warnings: string[];
}

export interface TestHistoryItem {
  id: string;
  success: boolean;
  message: string;
  latency: number;
  details: ConnectionTestResult['details'];
  detectedOS: string | null;
  detectedUsername: string | null;
  errors: string[];
  warnings: string[];
  testedAt: string;
  triggeredBy: {
    id: string;
    email: string;
    username: string;
  };
}

export interface CreateServerInput {
  name: string;
  environment?: string;
  tags?: string[];
  notes?: string;
  platformType: PlatformType;
  host: string;
  port: number;
  connectionProtocol: string;
  username: string;
  authType: AuthType;
  credentials: ServerCredentials;
  privilegeMode: PrivilegeMode;
  sudoMode: SudoMode;
  sudoPassword?: string;
  hostKeyStrategy: HostKeyStrategy;
  knownHostFingerprints?: Array<{
    keyType: string;
    fingerprint: string;
  }>;
}

export interface UpdateServerInput {
  name?: string;
  environment?: string;
  tags?: string[];
  notes?: string;
  host?: string;
  port?: number;
  username?: string;
  authType?: AuthType;
  credentials?: ServerCredentials;
  privilegeMode?: PrivilegeMode;
  sudoMode?: SudoMode;
  sudoPassword?: string;
  hostKeyStrategy?: HostKeyStrategy;
  knownHostFingerprints?: Array<{
    keyType: string;
    fingerprint: string;
  }>;
}

export interface ServerFilters {
  search?: string;
  platformType?: PlatformType;
  environment?: string;
  tags?: string;
  lastTestStatus?: TestStatus;
}

export interface ServerDependencies {
  serverId: string;
  serverName: string;
  hasDependencies: boolean;
  dependencies: {
    sites: {
      count: number;
      items: any[];
    };
    incidents: {
      count: number;
      items: any[];
    };
    jobs: {
      count: number;
      items: any[];
    };
  };
}
