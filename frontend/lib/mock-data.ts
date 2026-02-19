export type ServerStatus = "running" | "stopped" | "warning" | "critical" | "maintenance"

export interface ServerData {
  id: string
  name: string
  ip: string
  status: ServerStatus
  type: "VPS" | "Dedicated" | "Bare Metal"
  region: string
  os: string
  cpu: number
  ram: number
  disk: number
  bandwidth: string
  uptime: string
  specs: {
    cores: number
    ramTotal: string
    diskTotal: string
    diskType: string
  }
  monthlyPrice: number
  tags: string[]
}

export const servers: ServerData[] = [
  {
    id: "srv-001",
    name: "web-prod-01",
    ip: "45.33.32.156",
    status: "running",
    type: "VPS",
    region: "US East (Virginia)",
    os: "Ubuntu 22.04 LTS",
    cpu: 72,
    ram: 85,
    disk: 45,
    bandwidth: "2.4 TB",
    uptime: "45d 12h 32m",
    specs: { cores: 4, ramTotal: "8 GB", diskTotal: "160 GB", diskType: "NVMe SSD" },
    monthlyPrice: 24,
    tags: ["production", "web"],
  },
  {
    id: "srv-002",
    name: "web-prod-02",
    ip: "45.33.32.157",
    status: "running",
    type: "VPS",
    region: "US East (Virginia)",
    os: "Ubuntu 22.04 LTS",
    cpu: 58,
    ram: 62,
    disk: 38,
    bandwidth: "1.8 TB",
    uptime: "45d 12h 32m",
    specs: { cores: 4, ramTotal: "8 GB", diskTotal: "160 GB", diskType: "NVMe SSD" },
    monthlyPrice: 24,
    tags: ["production", "web"],
  },
  {
    id: "srv-003",
    name: "web-prod-03",
    ip: "45.33.32.158",
    status: "critical",
    type: "VPS",
    region: "EU West (Frankfurt)",
    os: "Ubuntu 22.04 LTS",
    cpu: 95,
    ram: 78,
    disk: 52,
    bandwidth: "3.1 TB",
    uptime: "12d 5h 14m",
    specs: { cores: 4, ramTotal: "8 GB", diskTotal: "160 GB", diskType: "NVMe SSD" },
    monthlyPrice: 24,
    tags: ["production", "web"],
  },
  {
    id: "srv-004",
    name: "api-gateway-01",
    ip: "159.89.214.32",
    status: "running",
    type: "Dedicated",
    region: "US East (Virginia)",
    os: "Debian 12",
    cpu: 68,
    ram: 64,
    disk: 28,
    bandwidth: "5.2 TB",
    uptime: "90d 3h 21m",
    specs: { cores: 8, ramTotal: "32 GB", diskTotal: "500 GB", diskType: "NVMe SSD" },
    monthlyPrice: 89,
    tags: ["production", "api"],
  },
  {
    id: "srv-005",
    name: "api-worker-04",
    ip: "159.89.214.36",
    status: "running",
    type: "VPS",
    region: "US East (Virginia)",
    os: "Debian 12",
    cpu: 42,
    ram: 55,
    disk: 22,
    bandwidth: "890 GB",
    uptime: "30d 8h 41m",
    specs: { cores: 4, ramTotal: "16 GB", diskTotal: "320 GB", diskType: "NVMe SSD" },
    monthlyPrice: 48,
    tags: ["production", "worker"],
  },
  {
    id: "srv-006",
    name: "db-master-01",
    ip: "178.62.198.44",
    status: "warning",
    type: "Bare Metal",
    region: "EU West (Frankfurt)",
    os: "Rocky Linux 9",
    cpu: 45,
    ram: 91,
    disk: 82,
    bandwidth: "1.2 TB",
    uptime: "120d 14h 8m",
    specs: { cores: 16, ramTotal: "128 GB", diskTotal: "2 TB", diskType: "NVMe SSD" },
    monthlyPrice: 199,
    tags: ["production", "database", "primary"],
  },
  {
    id: "srv-007",
    name: "db-replica-01",
    ip: "178.62.198.45",
    status: "running",
    type: "Bare Metal",
    region: "US East (Virginia)",
    os: "Rocky Linux 9",
    cpu: 32,
    ram: 68,
    disk: 78,
    bandwidth: "980 GB",
    uptime: "120d 14h 8m",
    specs: { cores: 16, ramTotal: "128 GB", diskTotal: "2 TB", diskType: "NVMe SSD" },
    monthlyPrice: 199,
    tags: ["production", "database", "replica"],
  },
  {
    id: "srv-008",
    name: "cache-node-01",
    ip: "104.131.186.12",
    status: "running",
    type: "VPS",
    region: "US East (Virginia)",
    os: "Ubuntu 22.04 LTS",
    cpu: 32,
    ram: 52,
    disk: 15,
    bandwidth: "450 GB",
    uptime: "60d 2h 55m",
    specs: { cores: 2, ramTotal: "4 GB", diskTotal: "80 GB", diskType: "SSD" },
    monthlyPrice: 12,
    tags: ["production", "cache"],
  },
  {
    id: "srv-009",
    name: "cache-node-02",
    ip: "104.131.186.13",
    status: "running",
    type: "VPS",
    region: "Asia Pacific (Singapore)",
    os: "Ubuntu 22.04 LTS",
    cpu: 28,
    ram: 48,
    disk: 12,
    bandwidth: "380 GB",
    uptime: "60d 2h 55m",
    specs: { cores: 2, ramTotal: "4 GB", diskTotal: "80 GB", diskType: "SSD" },
    monthlyPrice: 12,
    tags: ["production", "cache"],
  },
  {
    id: "srv-010",
    name: "web-staging-01",
    ip: "192.241.218.88",
    status: "running",
    type: "VPS",
    region: "US West (San Francisco)",
    os: "Ubuntu 22.04 LTS",
    cpu: 18,
    ram: 35,
    disk: 22,
    bandwidth: "120 GB",
    uptime: "15d 8h 12m",
    specs: { cores: 2, ramTotal: "4 GB", diskTotal: "80 GB", diskType: "SSD" },
    monthlyPrice: 12,
    tags: ["staging", "web"],
  },
  {
    id: "srv-011",
    name: "web-staging-02",
    ip: "192.241.218.89",
    status: "stopped",
    type: "VPS",
    region: "US West (San Francisco)",
    os: "Ubuntu 22.04 LTS",
    cpu: 0,
    ram: 0,
    disk: 22,
    bandwidth: "45 GB",
    uptime: "0d 0h 0m",
    specs: { cores: 2, ramTotal: "4 GB", diskTotal: "80 GB", diskType: "SSD" },
    monthlyPrice: 12,
    tags: ["staging", "web"],
  },
  {
    id: "srv-012",
    name: "monitoring-01",
    ip: "167.172.146.22",
    status: "maintenance",
    type: "VPS",
    region: "EU West (Frankfurt)",
    os: "Ubuntu 22.04 LTS",
    cpu: 0,
    ram: 0,
    disk: 56,
    bandwidth: "650 GB",
    uptime: "0d 0h 0m",
    specs: { cores: 4, ramTotal: "8 GB", diskTotal: "200 GB", diskType: "NVMe SSD" },
    monthlyPrice: 28,
    tags: ["infrastructure", "monitoring"],
  },
]

export function getServerById(id: string): ServerData | undefined {
  return servers.find((s) => s.id === id)
}

// Historical data for server detail view
export const serverCpuHistory = Array.from({ length: 48 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
  value: Math.floor(Math.random() * 40 + 30),
}))

export const serverRamHistory = Array.from({ length: 48 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
  value: Math.floor(Math.random() * 30 + 50),
}))

export const serverNetworkHistory = Array.from({ length: 48 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
  inbound: Math.floor(Math.random() * 300 + 50),
  outbound: Math.floor(Math.random() * 200 + 30),
}))

export const serverDiskIOHistory = Array.from({ length: 48 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
  read: Math.floor(Math.random() * 150 + 20),
  write: Math.floor(Math.random() * 100 + 10),
}))
