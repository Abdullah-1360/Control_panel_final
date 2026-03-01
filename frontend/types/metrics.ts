export interface DiskBreakdown {
  filesystem: string;
  mountPoint: string;
  diskTotalGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  diskUsagePercent: number;
  inodeTotal: number;
  inodeUsed: number;
  inodeFree: number;
  inodeUsagePercent: number;
}

export interface ServerMetrics {
  id: string;
  serverId: string;
  
  // CPU
  cpuUsagePercent: number;
  cpuCores?: number;
  loadAverage1m?: number;
  loadAverage5m?: number;
  loadAverage15m?: number;

  // Memory
  memoryTotalMB: number;
  memoryUsedMB: number;
  memoryFreeMB: number;
  memoryAvailableMB?: number;
  memoryUsagePercent: number;
  swapTotalMB?: number;
  swapUsedMB?: number;
  swapUsagePercent?: number;

  // Disk
  diskTotalGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  diskUsagePercent: number;
  diskReadMBps?: number;
  diskWriteMBps?: number;
  diskIops?: number;

  // Inodes (returned as strings from API due to BigInt serialization)
  inodeTotal?: string | number;
  inodeUsed?: string | number;
  inodeFree?: string | number;
  inodeUsagePercent?: number;
  diskBreakdown?: DiskBreakdown[];

  // Network
  networkRxMBps?: number;
  networkTxMBps?: number;
  networkRxTotalMB?: number;
  networkTxTotalMB?: number;

  // System
  uptime: number;
  processCount?: number;
  threadCount?: number;
  detectedOS?: string;
  kernelVersion?: string;

  // Collection metadata
  collectionLatency: number;
  collectionSuccess: boolean;
  collectionError?: string;
  collectedAt: string;
}

export interface AggregatedMetrics {
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgDiskUsage: number;
  avgInodeUsage: number;
  totalServers: number;
  serversWithMetrics: number;
  totalStorageGB: number;
  usedStorageGB: number;
  totalNetworkRxMB: number;
  totalNetworkTxMB: number;
  servers: Array<{
    serverId: string;
    serverName: string;
    metrics: ServerMetrics | null;
  }>;
}

export interface AggregatedMetricsHistoryPoint {
  id: string;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgDiskUsage: number;
  avgInodeUsage: number | null;
  totalServers: number;
  serversWithMetrics: number;
  totalStorageGB: number | null;
  usedStorageGB: number | null;
  totalNetworkRxMB: number | null;
  totalNetworkTxMB: number | null;
  collectedAt: string;
}
