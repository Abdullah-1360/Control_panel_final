import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TechStack, DetectionMethod, HealingMode, HealthStatus } from '@prisma/client';
import { TechStackDetectorService } from './tech-stack-detector.service';
import { PluginRegistryService } from './plugin-registry.service';
import { SSHExecutorService } from './ssh-executor.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BackupRollbackService } from './backup-rollback.service';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly techStackDetector: TechStackDetectorService,
    private readonly pluginRegistry: PluginRegistryService,
    private readonly sshExecutor: SSHExecutorService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly backupRollback: BackupRollbackService,
  ) {}

  /**
   * Get all applications with pagination and filters
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    techStack?: TechStack;
    healthStatus?: HealthStatus;
    serverId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Only filter by non-deleted servers if we're not filtering by a specific server
    // If filtering by serverId, let the user see apps even if server is soft-deleted
    if (!params.serverId) {
      where.servers = {
        deletedAt: null, // Exclude soft-deleted servers
      };
    } else {
      where.serverId = params.serverId;
    }

    if (params.search) {
      where.domain = {
        contains: params.search,
        mode: 'insensitive',
      };
    }

    if (params.techStack) {
      where.techStack = params.techStack;
    }

    if (params.healthStatus) {
      where.healthStatus = params.healthStatus;
    }

    this.logger.log(`Finding applications with filters: ${JSON.stringify(params)}`);
    this.logger.log(`Where clause: ${JSON.stringify(where)}`);

    const [applications, total] = await Promise.all([
      this.prisma.applications.findMany({
        where,
        skip,
        take: limit,
        include: {
          servers: {
            select: {
              id: true,
              name: true,
              host: true,
              platformType: true,
              deletedAt: true, // Include to see if server is deleted
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.applications.count({ where }),
    ]);

    this.logger.log(`Found ${applications.length} applications (total: ${total})`);
    if (applications.length > 0 && applications[0].servers.deletedAt) {
      this.logger.warn(`Server ${applications[0].servers.id} is soft-deleted (deletedAt: ${applications[0].servers.deletedAt})`);
    }

    return {
      data: applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get application by ID
   * Triggers on-demand tech stack detection and metadata collection
   */
  async findOne(id: string) {
    const application = await this.prisma.applications.findUnique({
      where: { id },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            platformType: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    // Trigger on-demand metadata collection if tech stack is still PHP_GENERIC
    // Wait for detection to complete before returning
    if (application.techStack === TechStack.PHP_GENERIC) {
      try {
        await this.collectDetailedMetadata(id);
        // Refresh application data after metadata collection
        const updatedApp = await this.prisma.applications.findUnique({
          where: { id },
          include: {
            servers: {
              select: {
                id: true,
                name: true,
                host: true,
                port: true,
                platformType: true,
              },
            },
          },
        });
        return updatedApp || application;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Failed to collect metadata for ${id}: ${err.message}`);
        // Return original application if metadata collection fails
        return application;
      }
    }

    return application;
  }

  /**
   * Create new application
   */
  async create(data: {
    serverId: string;
    domain: string;
    path: string;
    techStack: TechStack;
    detectionMethod?: DetectionMethod;
    version?: string;
    phpVersion?: string;
    dbName?: string;
    dbHost?: string;
  }) {
    return this.prisma.applications.create({
      data: {
        serverId: data.serverId,
        domain: data.domain,
        path: data.path,
        techStack: data.techStack,
        detectionMethod: data.detectionMethod || DetectionMethod.MANUAL,
        techStackVersion: data.version,
        metadata: {
          phpVersion: data.phpVersion,
          dbName: data.dbName,
          dbHost: data.dbHost || 'localhost',
        },
        isHealerEnabled: false,
        healingMode: HealingMode.MANUAL,
        healthStatus: HealthStatus.UNKNOWN,
        healthScore: 0,
      },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });
  }

  /**
   * Update application
   */
  async update(id: string, data: {
    domain?: string;
    path?: string;
    techStack?: TechStack;
    version?: string;
    phpVersion?: string;
    isHealerEnabled?: boolean;
    healingMode?: HealingMode;
  }) {
    const application = await this.findOne(id);

    return this.prisma.applications.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        servers: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });
  }

  /**
   * Delete application
   */
  async delete(id: string) {
    const application = await this.findOne(id);

    await this.prisma.applications.delete({
      where: { id },
    });

    return { message: 'Application deleted successfully' };
  }

  /**
   * Discover applications on a server
   */
  async discover(params: {
    serverId: string;
    paths?: string[];
    techStacks?: TechStack[];
    forceRediscover?: boolean;
  }) {
    this.logger.log(`Discovering applications on server ${params.serverId}`);

    const server = await this.prisma.servers.findUnique({
      where: { id: params.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${params.serverId} not found`);
    }

    // Use optimized batch discovery (single find command like WordPress discovery)
    const discoveredApps = await this.batchDiscoverApplications(
      server,
      params.paths || ['/var/www', '/home', '/srv', '/opt'],
      params.techStacks,
      params.forceRediscover || false,
    );

    this.logger.log(`Discovered ${discoveredApps.length} new applications`);

    return {
      discovered: discoveredApps.length,
      applications: discoveredApps,
    };
  }

  /**
   * Optimized batch discovery using cPanel domain detection
   * Follows WordPress healer pattern: detect domains first, then find applications
   * Prevents duplicate registration of subdirectories
   */
  private async batchDiscoverApplications(
    server: any,
    searchPaths: string[],
    techStacks?: TechStack[],
    forceRediscover: boolean = false,
  ): Promise<any[]> {
    this.logger.log(`Starting batch discovery on server ${server.id}`);
    
    // Try cPanel-based discovery first (most accurate)
    try {
      const cpanelApps = await this.discoverViaCPanel(server, techStacks, forceRediscover);
      if (cpanelApps.length > 0) {
        this.logger.log(`cPanel discovery found ${cpanelApps.length} applications`);
        return cpanelApps;
      }
    } catch (error) {
      this.logger.warn('cPanel discovery failed, falling back to generic discovery');
    }
    
    // Fallback to generic discovery for non-cPanel servers
    return await this.discoverGeneric(server, searchPaths, techStacks, forceRediscover);
  }

  /**
   * cPanel-based discovery: Register ONE application per document root path
   * Tech stack detection happens LATER when user clicks diagnose (like WordPress healer)
   * CRITICAL: Only register domains that have valid cPanel userdata files (filters out subdirectories)
   */
  private async discoverViaCPanel(
    server: any,
    techStacks?: TechStack[],
    forceRediscover: boolean = false,
  ): Promise<any[]> {
    this.logger.log('Attempting cPanel-based discovery');
    
    // STEP 1: Get ALL domains with their document root paths
    // This is the EXACT same method used by WordPress healer
    const allDomains = await this.getAllDomainsWithPaths(server.id);
    this.logger.log(`Found ${allDomains.length} domains from cPanel`);
    
    if (allDomains.length === 0) {
      throw new Error('Not a cPanel server or no domains found');
    }
    
    // STEP 2: Register ONE application per path
    // Tech stack detection will happen later when user clicks diagnose
    const apps: any[] = [];
    let skipped = 0;
    let updated = 0;
    let filtered = 0;
    
    for (const domainInfo of allDomains) {
      const { domain, path } = domainInfo;
      
      // CRITICAL FILTER: Only register if domain looks valid (has a dot)
      // This filters out subdirectory entries like "css", "site-data", "site-admin"
      if (!domain.includes('.')) {
        this.logger.debug(`Skipping non-domain entry: ${domain} (no dot found)`);
        filtered++;
        continue;
      }
      
      // Check if already exists
      const existing = await this.prisma.applications.findFirst({
        where: {
          serverId: server.id,
          path,
        },
      });
      
      if (existing && !forceRediscover) {
        skipped++;
        continue;
      }
      
      if (existing && forceRediscover) {
        const app = await this.prisma.applications.update({
          where: { id: existing.id },
          data: {
            domain,
            updatedAt: new Date(),
          },
        });
        apps.push(app);
        updated++;
        this.logger.log(`Updated application: ${domain} at ${path}`);
      } else {
        // Register with UNKNOWN tech stack - will be detected on-demand
        const app = await this.prisma.applications.create({
          data: {
            serverId: server.id,
            domain,
            path,
            techStack: TechStack.UNKNOWN, // UNKNOWN until detected
            detectionMethod: DetectionMethod.AUTO,
            detectionConfidence: 0.0, // No confidence until detected
            metadata: {},
            isHealerEnabled: false,
            healingMode: HealingMode.MANUAL,
            healthStatus: HealthStatus.UNKNOWN,
            healthScore: 0,
          },
        });
        
        apps.push(app);
        this.logger.log(`Discovered application: ${domain} at ${path}`);
      }
    }
    
    this.logger.log(`cPanel discovery complete: ${apps.length} applications registered (${updated} updated, ${skipped} skipped, ${filtered} filtered out)`);
    return apps;
  }

  /**
   * Get ALL domains with paths - COPIED from WordPress healer
   * This is the EXACT same method that prevents subdirectory registration
   */
  private async getAllDomainsWithPaths(serverId: string): Promise<Array<{domain: string, path: string, username: string}>> {
    try {
      // Step 1: Get PRIMARY domains from /etc/userdomains (NOT trueuserdomains)
      // /etc/userdomains contains ONLY primary domains mapped to usernames
      // /etc/trueuserdomains contains ALL domains (main + addon + subdomains) which causes duplicates
      const command = `cat /etc/userdomains`;
      const result = await this.sshExecutor.executeCommand(serverId, command);
      
      const domainUserMap: Array<{domain: string, username: string}> = [];
      const lines = result.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const [domain, username] = trimmed.split(':').map(s => s.trim());
        if (domain && username) {
          domainUserMap.push({ domain, username });
        }
      }
      
      this.logger.log(`Found ${domainUserMap.length} primary domains in /etc/userdomains`);
      
      // Step 2: Get ALL document roots in a single batch command (1 SSH call)
      const docRootMap = await this.getAllDocumentRootsBatch(serverId, domainUserMap);
      
      // Step 3: Build final domain list with paths
      const domains: Array<{domain: string, path: string, username: string}> = [];
      
      for (const { domain, username } of domainUserMap) {
        let path: string;
        
        // Check if we got document root from batch command
        const batchDocRoot = docRootMap.get(domain);
        if (batchDocRoot) {
          path = batchDocRoot;
        } else {
          // Fallback: Smart path guessing
          path = this.guessDocumentRoot(domain, username);
        }
        
        domains.push({ domain, path, username });
      }
      
      this.logger.log(`Mapped ${domains.length} entries to document roots`);
      return domains;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to get all domains: ${err.message}`);
      return [];
    }
  }

  /**
   * Get document roots for ALL domains in batches to avoid timeout
   * OPTIMIZED: Process in chunks of 50 domains with 60s timeout per chunk
   */
  private async getAllDocumentRootsBatch(
    serverId: string,
    domains: Array<{domain: string, username: string}>,
  ): Promise<Map<string, string>> {
    const docRootMap = new Map<string, string>();
    const chunkSize = 50; // Process 50 domains at a time
    
    try {
      // Process domains in chunks to avoid command length limits and timeouts
      for (let i = 0; i < domains.length; i += chunkSize) {
        const chunk = domains.slice(i, i + chunkSize);
        this.logger.debug(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(domains.length / chunkSize)} (${chunk.length} domains)`);
        
        // Build optimized batch command using for loop instead of chaining
        const domainList = chunk.map(d => `${d.domain}:${d.username}`).join(' ');
        const command = `for item in ${domainList}; do domain=\${item%%:*}; user=\${item##*:}; docroot=$(grep -E "^documentroot:" /var/cpanel/userdata/$user/$domain 2>/dev/null | cut -d: -f2- | xargs); [ -n "$docroot" ] && echo "$domain|$docroot"; done`;
        
        // Use 60-second timeout for each chunk
        const result = await this.sshExecutor.executeCommand(serverId, command, 60000);
      
        if (result && result.trim()) {
          const lines = result.trim().split('\n');
          for (const line of lines) {
            const [domain, docRoot] = line.split('|');
            if (domain && docRoot && docRoot.startsWith('/')) {
              docRootMap.set(domain.trim(), docRoot.trim());
            }
          }
        }
      }
      
      this.logger.log(`Got ${docRootMap.size} document roots from userdata files`);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to get document roots from userdata: ${err.message}`);
    }
    
    return docRootMap;
  }

  /**
   * Guess document root based on cPanel conventions
   * COPIED from WordPress healer
   */
  private guessDocumentRoot(domain: string, username: string): string {
    // Main domain: /home/username/public_html
    // Addon domain: /home/username/addondomain.com or /home/username/public_html/addondomain.com
    
    // For now, use public_html as default
    // The find command will search subdirectories if needed
    return `/home/${username}/public_html`;
  }

  /**
   * Generic discovery for non-cPanel servers
   * Falls back to directory-based detection with smart deduplication
   */
  private async discoverGeneric(
    server: any,
    searchPaths: string[],
    techStacks?: TechStack[],
    forceRediscover: boolean = false,
  ): Promise<any[]> {
    this.logger.log('Starting generic discovery');
    
    // Build indicator list based on requested tech stacks
    const indicators = this.buildIndicatorsList(techStacks);
    this.logger.log(`Looking for indicators: ${indicators.join(', ')}`);
    
    // Single find command to locate all indicators at once
    const nameConditions = indicators.map(ind => `-name "${ind}"`).join(' -o ');
    const pathList = searchPaths.join(' ');
    const findCommand = `find ${pathList} -maxdepth 4 \\( ${nameConditions} \\) -type f 2>/dev/null | head -1000`;
    
    this.logger.log(`Executing batch find command`);
    
    const result = await this.sshExecutor.executeCommand(server.id, findCommand);
    
    if (!result || !result.trim()) {
      this.logger.log('No application indicators found');
      return [];
    }
    
    // Parse and group files by directory
    const foundFiles = result.trim().split('\n').filter(Boolean);
    const pathMap = new Map<string, string[]>();
    
    for (const filePath of foundFiles) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
      
      if (!pathMap.has(dir)) {
        pathMap.set(dir, []);
      }
      pathMap.get(dir)!.push(fileName);
    }
    
    this.logger.log(`Found ${pathMap.size} potential application directories`);
    
    // SMART DEDUPLICATION: Remove WordPress subdirectories and parent/child duplicates
    const deduplicated = this.deduplicateApplicationPaths(pathMap);
    this.logger.log(`After deduplication: ${deduplicated.size} unique applications`);
    
    // Classify and register applications (fast registration without metadata)
    const apps: any[] = [];
    let skipped = 0;
    let updated = 0;
    
    for (const [path, files] of deduplicated.entries()) {
      const techStack = this.determineTechStack(files);
      
      if (techStack === 'UNKNOWN') {
        this.logger.debug(`Skipping ${path} - unknown tech stack`);
        continue;
      }
      
      // Check if already exists
      const existing = await this.prisma.applications.findFirst({
        where: {
          serverId: server.id,
          path,
        },
      });
      
      if (existing && !forceRediscover) {
        this.logger.debug(`Skipping ${path} - already exists`);
        skipped++;
        continue;
      }
      
      // OPTIMIZATION: Skip domain extraction during discovery to prevent server flooding
      // Domain will be extracted on-demand when user views the application
      // Use path-based name as fallback
      const domain = path.split('/').pop() || server.host;
      
      if (existing && forceRediscover) {
        // Update existing application
        const app = await this.prisma.applications.update({
          where: { id: existing.id },
          data: {
            techStack: techStack as TechStack,
            detectionConfidence: this.calculateConfidence(files, techStack),
            metadata: { detectedFiles: files },
            updatedAt: new Date(),
          },
        });
        apps.push(app);
        updated++;
        this.logger.log(`Updated ${techStack} application at ${path}`);
      } else {
        // Create new application with minimal metadata
        // Detailed metadata (version, dependencies, domain, etc.) will be collected on-demand
        // when user clicks diagnose - same pattern as WordPress discovery
        const app = await this.prisma.applications.create({
          data: {
            serverId: server.id,
            domain,
            path,
            techStack: techStack as TechStack,
            detectionMethod: DetectionMethod.AUTO,
            detectionConfidence: this.calculateConfidence(files, techStack),
            metadata: { detectedFiles: files },
            isHealerEnabled: false,
            healingMode: HealingMode.MANUAL,
            healthStatus: HealthStatus.UNKNOWN,
            healthScore: 0,
          },
        });
        
        apps.push(app);
        this.logger.log(`Discovered ${techStack} application at ${path}`);
      }
    }
    
    this.logger.log(`Discovery complete: ${apps.length} applications registered (${updated} updated, ${skipped} skipped)`);
    return apps;
  }

  /**
   * Smart deduplication of application paths
   * Removes WordPress subdirectories and parent/child duplicates
   */
  private deduplicateApplicationPaths(
    pathMap: Map<string, string[]>,
  ): Map<string, string[]> {
    const deduplicated = new Map<string, string[]>();
    const wordpressRoots = new Set<string>();
    
    // First pass: Identify WordPress roots (directories with wp-config.php)
    for (const [path, files] of pathMap.entries()) {
      if (files.includes('wp-config.php')) {
        wordpressRoots.add(path);
      }
    }
    
    // Second pass: Filter out WordPress subdirectories and duplicates
    for (const [path, files] of pathMap.entries()) {
      // Skip if this is a WordPress subdirectory
      if (this.isWordPressSubdirectory(path, wordpressRoots)) {
        this.logger.debug(`Skipping WordPress subdirectory: ${path}`);
        continue;
      }
      
      // Skip if this is a child of an already registered application
      if (this.hasParentApplication(path, deduplicated)) {
        this.logger.debug(`Skipping child directory: ${path}`);
        continue;
      }
      
      // Skip if this is a parent of an already registered application
      // (prefer more specific paths)
      if (this.hasChildApplication(path, deduplicated)) {
        this.logger.debug(`Skipping parent directory: ${path}`);
        continue;
      }
      
      deduplicated.set(path, files);
    }
    
    return deduplicated;
  }

  /**
   * Check if path is a WordPress subdirectory
   */
  private isWordPressSubdirectory(path: string, wordpressRoots: Set<string>): boolean {
    const wpSubdirs = ['wp-admin', 'wp-content', 'wp-includes'];
    const dirName = path.split('/').pop() || '';
    
    // Check if this directory name is a WordPress subdirectory
    if (wpSubdirs.includes(dirName)) {
      // Verify it's actually under a WordPress root
      for (const root of wordpressRoots) {
        if (path.startsWith(root + '/')) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if path has a parent application already registered
   */
  private hasParentApplication(
    path: string,
    registered: Map<string, string[]>,
  ): boolean {
    for (const registeredPath of registered.keys()) {
      if (path.startsWith(registeredPath + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if path has a child application already registered
   */
  private hasChildApplication(
    path: string,
    registered: Map<string, string[]>,
  ): boolean {
    for (const registeredPath of registered.keys()) {
      if (registeredPath.startsWith(path + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Build list of file indicators based on requested tech stacks
   */
  private buildIndicatorsList(techStacks?: TechStack[]): string[] {
    const allIndicators: Record<string, string[]> = {
      WORDPRESS: ['wp-config.php', 'wp-content'],
      NODEJS: ['package.json'],
      LARAVEL: ['artisan', 'composer.json'],
      NEXTJS: ['next.config.js', 'next.config.ts'],
      EXPRESS: ['package.json'],
      PHP: ['index.php', 'composer.json'],
    };
    
    if (!techStacks || techStacks.length === 0) {
      // Return all indicators (auto-detect mode)
      return [...new Set(Object.values(allIndicators).flat())];
    }
    
    // Return only requested tech stack indicators
    const indicators: string[] = [];
    for (const stack of techStacks) {
      const stackKey = stack.toString();
      if (allIndicators[stackKey]) {
        indicators.push(...allIndicators[stackKey]);
      }
    }
    
    return [...new Set(indicators)];
  }

  /**
   * Determine tech stack based on found files
   * Priority-based classification
   */
  private determineTechStack(files: string[]): string {
    // WordPress - highest priority (most specific)
    if (files.includes('wp-config.php')) {
      return 'WORDPRESS';
    }
    
    // Laravel - requires both artisan and composer.json
    if (files.includes('artisan') && files.includes('composer.json')) {
      return 'LARAVEL';
    }
    
    // Next.js - requires next config
    if (files.includes('next.config.js') || files.includes('next.config.ts')) {
      return 'NEXTJS';
    }
    
    // Node.js/Express - requires package.json
    // Note: Will need to read package.json to distinguish Node from Express
    // For now, classify as NODEJS (can refine later with metadata collection)
    if (files.includes('package.json')) {
      return 'NODEJS';
    }
    
    // PHP Generic - fallback for PHP applications
    if (files.includes('composer.json') || files.includes('index.php')) {
      return 'PHP_GENERIC';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Calculate confidence score based on found files
   */
  private calculateConfidence(files: string[], techStack: string): number {
    const requiredFiles: Record<string, string[]> = {
      WORDPRESS: ['wp-config.php'],
      LARAVEL: ['artisan', 'composer.json'],
      NEXTJS: ['next.config.js', 'package.json'],
      NODEJS: ['package.json'],
      EXPRESS: ['package.json'],
      PHP_GENERIC: ['index.php'],
    };
    
    const required = requiredFiles[techStack] || [];
    if (required.length === 0) return 0.5;
    
    const found = required.filter(f => files.includes(f)).length;
    return found / required.length;
  }

  /**
   * Extract domain from web server configuration
   * Tries nginx and Apache configs
   */
  private async extractDomain(serverId: string, path: string): Promise<string | null> {
    try {
      // Try nginx config
      const nginxCmd = `grep -r "root ${path}" /etc/nginx/sites-enabled/ 2>/dev/null | grep server_name | head -n 1 | sed 's/.*server_name //;s/;.*//' || true`;
      const nginxResult = await this.sshExecutor.executeCommand(serverId, nginxCmd);
      
      if (nginxResult && nginxResult.trim()) {
        return nginxResult.trim().split(' ')[0];
      }
      
      // Try Apache config
      const apacheCmd = `grep -r "DocumentRoot ${path}" /etc/apache2/sites-enabled/ /etc/httpd/conf.d/ 2>/dev/null | grep ServerName | head -n 1 | awk '{print $2}' || true`;
      const apacheResult = await this.sshExecutor.executeCommand(serverId, apacheCmd);
      
      if (apacheResult && apacheResult.trim()) {
        return apacheResult.trim();
      }
      
      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to extract domain for ${path}: ${err.message}`);
      return null;
    }
  }

  /**
   * Diagnose application using tech stack plugin
   * OPTIMIZED: Collects metadata before running diagnostics (Strategy 3 - Two-Phase Discovery)
   * Supports subdomain/addon diagnosis by using subdomain's path
   */
  async diagnose(applicationId: string, subdomain?: string) {
    this.logger.log(`Diagnosing application ${applicationId}${subdomain ? ` (subdomain: ${subdomain})` : ''}`);

    const application = await this.findOne(applicationId);
    
    // Handle subdomain diagnosis
    let diagnosisPath = application.path;
    let diagnosisDomain = application.domain;
    
    if (subdomain) {
      // Find the subdomain in availableSubdomains
      const subdomains = (application.metadata as any)?.availableSubdomains || [];
      const subdomainInfo = subdomains.find((s: any) => s.domain === subdomain);
      
      if (subdomainInfo) {
        diagnosisPath = subdomainInfo.path;
        diagnosisDomain = subdomain;
        this.logger.log(`Using subdomain path: ${diagnosisPath}`);
      } else {
        throw new NotFoundException(`Subdomain ${subdomain} not found for application ${applicationId}`);
      }
    }
    
    // Create a temporary application object with subdomain path
    const diagnosisApp = {
      ...application,
      path: diagnosisPath,
      domain: diagnosisDomain,
    };
    
    // Collect detailed metadata if not already collected
    // This ensures we have version info before running diagnostics
    if (!application.techStackVersion || !application.metadata) {
      this.logger.log(`Collecting metadata before diagnosis for ${diagnosisDomain}`);
      try {
        await this.collectDetailedMetadata(applicationId);
        // Refresh application data after metadata collection
        const updatedApp = await this.findOne(applicationId);
        Object.assign(application, updatedApp);
        Object.assign(diagnosisApp, { ...updatedApp, path: diagnosisPath, domain: diagnosisDomain });
      } catch (error) {
        this.logger.warn(`Failed to collect metadata, continuing with diagnosis: ${error}`);
      }
    }
    
    // Check if tech stack is UNKNOWN - require detection first
    if (diagnosisApp.techStack === TechStack.UNKNOWN) {
      throw new BadRequestException(
        `Tech stack is unknown for ${diagnosisDomain}. ` +
        `Please detect the tech stack first using the "Detect Tech Stack" button, ` +
        `or manually override the tech stack in the configuration.`
      );
    }
    
    const server = await this.prisma.servers.findUnique({
      where: { id: diagnosisApp.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${diagnosisApp.serverId} not found`);
    }

    const plugin = this.pluginRegistry.getPlugin(diagnosisApp.techStack);
    if (!plugin) {
      throw new NotFoundException(
        `No plugin found for tech stack: ${diagnosisApp.techStack}. ` +
        `Supported tech stacks: WordPress, Laravel, Node.js, Next.js, Express, PHP Generic. ` +
        `Please verify the tech stack is correct or use the override feature.`
      );
    }

    // Get all diagnostic checks for this tech stack
    const checkNames = plugin.getDiagnosticChecks();
    const results: any[] = [];

    // Execute each check
    for (const checkName of checkNames) {
      try {
        const result = await plugin.executeDiagnosticCheck(checkName, diagnosisApp, server);
        
        // Store result in database
        await this.prisma.diagnostic_results.create({
          data: {
            applicationId: application.id,
            subdomain: subdomain || null, // Store subdomain if provided
            checkName: result.checkName,
            checkCategory: result.category as any, // Cast to match Prisma enum
            status: result.status as any,
            severity: result.severity as any,
            message: result.message,
            details: result.details || {},
            suggestedFix: result.suggestedFix,
            executionTime: result.executionTime,
          },
        });

        results.push(result);
      } catch (error: any) {
        this.logger.error(`Check ${checkName} failed: ${error?.message || 'Unknown error'}`);
        results.push({
          checkName,
          category: 'SYSTEM',
          status: 'ERROR',
          severity: 'MEDIUM',
          message: `Check failed: ${error?.message || 'Unknown error'}`,
          executionTime: 0,
        });
      }
    }

    // Calculate and update health score
    if (subdomain) {
      // Calculate health score for subdomain
      await this.calculateSubdomainHealthScore(applicationId, subdomain);
    } else {
      // Calculate health score for main application
      await this.calculateHealthScore(applicationId);
      await this.updateHealthStatus(applicationId);
    }

    this.logger.log(`Diagnosis complete: ${results.length} checks executed`);

    return {
      applicationId,
      subdomain: subdomain || null,
      techStack: application.techStack,
      checksExecuted: results.length,
      results,
    };
  }

  /**
   * Get diagnostic results for an application
   */
  async getDiagnosticResults(applicationId: string, limit: number = 50) {
    const results = await this.prisma.diagnostic_results.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return results;
  }

  /**
   * Calculate health score based on diagnostic results
   */
  async calculateHealthScore(applicationId: string): Promise<number> {
    const results = await this.prisma.diagnostic_results.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Consider last 50 checks
    });

    if (results.length === 0) {
      return 0;
    }

    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of results) {
      // Weight by severity (risk level)
      let weight = 1;
      switch (result.severity) {
        case 'CRITICAL':
          weight = 4;
          break;
        case 'HIGH':
          weight = 3;
          break;
        case 'MEDIUM':
          weight = 2;
          break;
        case 'LOW':
          weight = 1;
          break;
      }

      totalWeight += weight;

      // Score by status
      if (result.status === 'PASS') {
        weightedScore += weight * 100;
      } else if (result.status === 'WARN') {
        weightedScore += weight * 50;
      }
      // FAIL or ERROR = 0 points
    }

    const healthScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Update application health score
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: { healthScore },
    });

    return healthScore;
  }

  /**
   * Update health status based on health score
   */
  async updateHealthStatus(applicationId: string): Promise<HealthStatus> {
    const application = await this.findOne(applicationId);
    const healthScore = application.healthScore ?? 0;

    let healthStatus: HealthStatus;

    if (healthScore >= 90) {
      healthStatus = HealthStatus.HEALTHY;
    } else if (healthScore >= 70) {
      healthStatus = HealthStatus.DEGRADED;
    } else if (healthScore >= 50) {
      healthStatus = HealthStatus.DOWN;
    } else {
      healthStatus = HealthStatus.DOWN;
    }

    await this.prisma.applications.update({
      where: { id: applicationId },
      data: { healthStatus },
    });

    return healthStatus;
  }

  /**
   * Execute healing action on application
   * Supports subdomain/addon healing by using subdomain's path
   */
  async heal(applicationId: string, actionName: string, subdomain?: string, bypassApproval: boolean = false) {
    this.logger.log(`Executing healing action ${actionName} on application ${applicationId}${subdomain ? ` (subdomain: ${subdomain})` : ''}`);

    const application = await this.findOne(applicationId);
    
    // CIRCUIT BREAKER CHECK
    const circuitStatus = await this.circuitBreaker.canHeal(applicationId);
    if (!circuitStatus.allowed) {
      this.logger.error(`Circuit breaker preventing healing for application ${applicationId}: ${circuitStatus.reason}`);
      throw new BadRequestException(circuitStatus.reason);
    }
    
    if (circuitStatus.state === 'HALF_OPEN') {
      this.logger.warn(`Circuit breaker in HALF_OPEN state, allowing test healing for application ${applicationId}`);
    }
    
    // Determine healing mode and healer status
    let healingMode = application.healingMode;
    let isHealerEnabled = application.isHealerEnabled;
    let healingPath = application.path;
    let healingDomain = application.domain;
    
    if (subdomain) {
      // Find the subdomain in availableSubdomains
      const subdomains = (application.metadata as any)?.availableSubdomains || [];
      const subdomainInfo = subdomains.find((s: any) => s.domain === subdomain);
      
      if (subdomainInfo) {
        healingPath = subdomainInfo.path;
        healingDomain = subdomain;
        // Use subdomain-specific settings if available
        healingMode = subdomainInfo.healingMode || healingMode;
        isHealerEnabled = subdomainInfo.isHealerEnabled !== undefined ? subdomainInfo.isHealerEnabled : isHealerEnabled;
        this.logger.log(`Using subdomain path: ${healingPath}, mode: ${healingMode}, enabled: ${isHealerEnabled}`);
      } else {
        throw new NotFoundException(`Subdomain ${subdomain} not found for application ${applicationId}`);
      }
    }
    
    // Check if healer is enabled
    if (!isHealerEnabled && !bypassApproval) {
      throw new BadRequestException('Healer is not enabled for this application/subdomain');
    }
    
    // Create a temporary application object with subdomain path
    const healingApp = {
      ...application,
      path: healingPath,
      domain: healingDomain,
    };
    
    const server = await this.prisma.servers.findUnique({
      where: { id: healingApp.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${healingApp.serverId} not found`);
    }

    const plugin = this.pluginRegistry.getPlugin(healingApp.techStack);
    if (!plugin) {
      throw new NotFoundException(`No plugin found for tech stack: ${healingApp.techStack}`);
    }

    // Get healing action details to check risk level
    const healingActions = plugin.getHealingActions();
    const action = healingActions.find(a => a.name === actionName);
    
    if (!action) {
      throw new NotFoundException(`Healing action ${actionName} not found for tech stack ${healingApp.techStack}`);
    }

    // HEALING MODE ENFORCEMENT
    if (!bypassApproval) {
      const canAutoHeal = this.canAutoHeal(healingMode, action.riskLevel);
      
      if (!canAutoHeal) {
        this.logger.warn(`Healing action ${actionName} requires approval (mode: ${healingMode}, risk: ${action.riskLevel})`);
        throw new BadRequestException(
          `Healing action "${actionName}" requires manual approval. ` +
          `Risk level: ${action.riskLevel}, Healing mode: ${healingMode}. ` +
          `Please review and approve this action before execution.`
        );
      }
      
      this.logger.log(`Auto-healing approved for ${actionName} (mode: ${healingMode}, risk: ${action.riskLevel})`);
    } else {
      this.logger.log(`Healing action ${actionName} bypassing approval check (manual execution)`);
    }

    // BACKUP BEFORE RISKY OPERATIONS
    let backupResult = null;
    if (action.requiresBackup || action.riskLevel === 'HIGH' || action.riskLevel === 'CRITICAL') {
      this.logger.log(`Creating backup before ${actionName} (risk: ${action.riskLevel})`);
      backupResult = await this.backupRollback.createBackup(applicationId, actionName);
      
      if (!backupResult.success) {
        this.logger.error(`Backup failed, aborting healing action: ${backupResult.message}`);
        throw new BadRequestException(`Backup failed: ${backupResult.message}. Healing aborted for safety.`);
      }
      
      this.logger.log(`Backup created successfully: ${backupResult.backupId}`);
    }

    // Execute healing action
    let result;
    try {
      result = await plugin.executeHealingAction(actionName, healingApp, server);
      
      // CIRCUIT BREAKER: Record success or failure
      if (result.success) {
        await this.circuitBreaker.recordSuccess(applicationId);
        this.logger.log(`Circuit breaker: Recorded successful healing for application ${applicationId}`);
      } else {
        await this.circuitBreaker.recordFailure(applicationId);
        this.logger.warn(`Circuit breaker: Recorded failed healing for application ${applicationId}`);
        
        // ROLLBACK ON FAILURE (if backup was created)
        if (backupResult) {
          this.logger.warn(`Healing failed, attempting rollback to backup: ${backupResult.backupId}`);
          const rollbackResult = await this.backupRollback.rollback(applicationId, backupResult.backupId);
          
          if (rollbackResult.success) {
            this.logger.log(`Rollback successful: ${rollbackResult.restoredFiles.length} files restored`);
            result.message += ` | Rollback successful: ${rollbackResult.restoredFiles.length} files restored`;
          } else {
            this.logger.error(`Rollback failed: ${rollbackResult.message}`);
            result.message += ` | Rollback failed: ${rollbackResult.message}`;
          }
        }
      }
    } catch (error: any) {
      // Record failure in circuit breaker
      await this.circuitBreaker.recordFailure(applicationId);
      this.logger.error(`Healing action failed with exception: ${error?.message || 'Unknown error'}`);
      
      // ROLLBACK ON EXCEPTION (if backup was created)
      if (backupResult) {
        this.logger.warn(`Healing failed with exception, attempting rollback to backup: ${backupResult.backupId}`);
        const rollbackResult = await this.backupRollback.rollback(applicationId, backupResult.backupId);
        
        if (rollbackResult.success) {
          this.logger.log(`Rollback successful after exception: ${rollbackResult.restoredFiles.length} files restored`);
        } else {
          this.logger.error(`Rollback failed after exception: ${rollbackResult.message}`);
        }
      }
      
      throw error;
    }

    // Store healing result in database (if healing_actions table exists)
    try {
      await this.prisma.$executeRaw`
        INSERT INTO healing_actions (application_id, action_name, status, message, details, executed_at, created_at, updated_at)
        VALUES (${applicationId}, ${actionName}, ${result.success ? 'SUCCESS' : 'FAILED'}, ${result.message}, ${JSON.stringify(result.details || {})}, NOW(), NOW(), NOW())
      `;
    } catch (error) {
      // Table might not exist yet, just log
      this.logger.warn('Could not store healing action result (table may not exist)');
    }

    this.logger.log(`Healing action ${actionName} ${result.success ? 'succeeded' : 'failed'}`);

    return {
      applicationId,
      actionName,
      subdomain: subdomain || null,
      success: result.success,
      message: result.message,
      details: result.details,
      riskLevel: action.riskLevel,
      healingMode,
      backupId: backupResult?.backupId,
      circuitBreakerState: circuitStatus.state,
    };
  }

  /**
   * Determine if an action can be auto-healed based on healing mode and risk level
   * 
   * MANUAL: Never auto-heal (always require approval)
   * SEMI_AUTO: Auto-heal LOW risk only
   * FULL_AUTO: Auto-heal LOW and MEDIUM risk
   * 
   * HIGH and CRITICAL risk always require approval
   */
  private canAutoHeal(mode: string, riskLevel: string): boolean {
    // HIGH and CRITICAL always require approval
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      return false;
    }
    
    switch (mode) {
      case 'MANUAL':
        return false; // Never auto-heal
        
      case 'SEMI_AUTO':
        return riskLevel === 'LOW'; // Only LOW risk
        
      case 'FULL_AUTO':
        return riskLevel === 'LOW' || riskLevel === 'MEDIUM'; // LOW and MEDIUM
        
      default:
        return false; // Unknown mode, require approval
    }
  }

  /**
   * Collect detailed metadata for an application (on-demand)
   * This is called when user clicks on application or runs diagnostics
   * Follows Strategy 3 (Two-Phase Discovery) from optimization document
   * 
   * ENHANCED: Now includes domain/subdomain detection like WordPress healer
   */
  async collectDetailedMetadata(applicationId: string): Promise<void> {
    this.logger.log(`Collecting detailed metadata for application ${applicationId}`);

    const app = await this.prisma.applications.findUnique({
      where: { id: applicationId },
    });

    if (!app) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    try {
      // STEP 1: Detect actual tech stack if UNKNOWN or PHP_GENERIC
      // Only auto-detect if explicitly requested or if PHP_GENERIC (legacy)
      if (app.techStack === TechStack.UNKNOWN || app.techStack === TechStack.PHP_GENERIC) {
        this.logger.log(`Tech stack is ${app.techStack}, skipping auto-detection during metadata collection`);
        this.logger.log(`Use detectTechStack() endpoint to detect tech stack manually`);
        // Don't auto-detect - let user trigger detection manually
        // This prevents unwanted tech stack changes during diagnosis
      }
      
      // STEP 2: Extract real domain from cPanel userdata or server config
      let domain = app.domain;
      let domainType: 'main' | 'subdomain' | 'addon' | 'unknown' = 'unknown';
      let cPanelUsername: string | undefined;
      
      // Try to extract cPanel username from path
      const pathMatch = app.path.match(/^\/home\/([^\/]+)\//);
      if (pathMatch) {
        cPanelUsername = pathMatch[1];
        this.logger.log(`Detected cPanel username: ${cPanelUsername}`);
        
        // Get domain info from cPanel userdata
        const domainInfo = await this.extractDomainFromCPanel(app.serverId, app.path, cPanelUsername);
        if (domainInfo) {
          domain = domainInfo.domain;
          domainType = domainInfo.type;
          this.logger.log(`Detected domain: ${domain} (type: ${domainType})`);
        }
      }
      
      // Fallback: Extract from web server config if cPanel detection failed
      if (!domain || domain === app.path.split('/').pop()) {
        this.logger.log(`Extracting domain from web server config for ${app.path}`);
        const extractedDomain = await this.extractDomain(app.serverId, app.path);
        if (extractedDomain) {
          domain = extractedDomain;
        }
      }
      
      // STEP 3: Detect subdomains, addon domains, and parked domains (cPanel only)
      let availableSubdomains: any[] = [];
      if (cPanelUsername) {
        this.logger.log(`Detecting subdomains for ${domain}`);
        availableSubdomains = await this.detectSubdomainsAndAddons(app.serverId, cPanelUsername, domain);
        this.logger.log(`Found ${availableSubdomains.length} related domains`);
      }
      
      // STEP 4: Get plugin for tech stack
      const plugin = this.pluginRegistry.getPlugin(app.techStack);
      
      if (!plugin) {
        this.logger.warn(`No plugin found for tech stack: ${app.techStack}`);
        // Still update domain info even without plugin
        await this.prisma.applications.update({
          where: { id: applicationId },
          data: {
            domain,
            metadata: {
              ...(app.metadata as any),
              domainType,
              cPanelUsername,
              availableSubdomains,
            },
            updatedAt: new Date(),
          },
        });
        return;
      }

      // Get server
      const server = await this.prisma.servers.findUnique({
        where: { id: app.serverId },
      });

      if (!server) {
        throw new NotFoundException(`Server ${app.serverId} not found`);
      }

      // STEP 5: Collect version information
      let version: string | undefined;
      let phpVersion: string | undefined;
      let dbName: string | undefined;
      let dbHost: string | undefined;

      // Tech stack specific metadata collection
      if (app.techStack === 'WORDPRESS') {
        // WordPress version
        try {
          const versionCmd = `grep "wp_version = " ${app.path}/wp-includes/version.php | cut -d "'" -f 2`;
          const versionResult = await this.sshExecutor.executeCommand(app.serverId, versionCmd);
          version = versionResult?.trim();
        } catch (error) {
          this.logger.warn(`Failed to get WordPress version: ${error}`);
        }

        // PHP version
        try {
          const phpCmd = `cd ${app.path} && php -v | head -n 1 | cut -d ' ' -f 2`;
          const phpResult = await this.sshExecutor.executeCommand(app.serverId, phpCmd);
          phpVersion = phpResult?.trim();
        } catch (error) {
          this.logger.warn(`Failed to get PHP version: ${error}`);
        }

        // Database info from wp-config.php
        try {
          const dbNameCmd = `grep "DB_NAME" ${app.path}/wp-config.php | cut -d "'" -f 4`;
          const dbNameResult = await this.sshExecutor.executeCommand(app.serverId, dbNameCmd);
          dbName = dbNameResult?.trim();

          const dbHostCmd = `grep "DB_HOST" ${app.path}/wp-config.php | cut -d "'" -f 4`;
          const dbHostResult = await this.sshExecutor.executeCommand(app.serverId, dbHostCmd);
          dbHost = dbHostResult?.trim();
        } catch (error) {
          this.logger.warn(`Failed to get database info: ${error}`);
        }
      } else if (app.techStack === 'NODEJS' || app.techStack === 'NEXTJS' || app.techStack === 'EXPRESS') {
        // Node.js version
        try {
          const nodeCmd = `cd ${app.path} && node -v`;
          const nodeResult = await this.sshExecutor.executeCommand(app.serverId, nodeCmd);
          version = nodeResult?.trim().replace('v', '');
        } catch (error) {
          this.logger.warn(`Failed to get Node.js version: ${error}`);
        }

        // Read package.json for more details
        try {
          const packageJson = await this.sshExecutor.executeCommand(
            app.serverId,
            `cat ${app.path}/package.json`,
          );
          const pkg = JSON.parse(packageJson);
          
          // Store package.json data in metadata
          await this.prisma.applications.update({
            where: { id: applicationId },
            data: {
              metadata: {
                ...(app.metadata as any),
                packageName: pkg.name,
                packageVersion: pkg.version,
                dependencies: pkg.dependencies,
                devDependencies: pkg.devDependencies,
                domainType,
                cPanelUsername,
                availableSubdomains,
              },
            },
          });
        } catch (error) {
          this.logger.warn(`Failed to read package.json: ${error}`);
        }
      } else if (app.techStack === 'LARAVEL' || app.techStack === 'PHP_GENERIC') {
        // PHP version
        try {
          const phpCmd = `cd ${app.path} && php -v | head -n 1 | cut -d ' ' -f 2`;
          const phpResult = await this.sshExecutor.executeCommand(app.serverId, phpCmd);
          phpVersion = phpResult?.trim();
        } catch (error) {
          this.logger.warn(`Failed to get PHP version: ${error}`);
        }

        // Laravel version (if Laravel)
        if (app.techStack === 'LARAVEL') {
          try {
            const laravelCmd = `cd ${app.path} && php artisan --version | cut -d ' ' -f 3`;
            const laravelResult = await this.sshExecutor.executeCommand(app.serverId, laravelCmd);
            version = laravelResult?.trim();
          } catch (error) {
            this.logger.warn(`Failed to get Laravel version: ${error}`);
          }
        }

        // Read .env for database info
        try {
          const envContent = await this.sshExecutor.executeCommand(
            app.serverId,
            `cat ${app.path}/.env`,
          );
          
          const dbNameMatch = envContent.match(/DB_DATABASE=(.+)/);
          const dbHostMatch = envContent.match(/DB_HOST=(.+)/);
          
          if (dbNameMatch) dbName = dbNameMatch[1].trim();
          if (dbHostMatch) dbHost = dbHostMatch[1].trim();
        } catch (error) {
          this.logger.warn(`Failed to read .env file: ${error}`);
        }
      }

      // Update application with collected metadata
      // Use techStackVersion for version, store phpVersion in metadata
      const metadataUpdate: any = {
        ...(app.metadata as any),
        phpVersion: phpVersion || undefined,
        dbName: dbName || undefined,
        dbHost: dbHost || undefined,
        domainType,
        cPanelUsername,
        availableSubdomains,
      };

      await this.prisma.applications.update({
        where: { id: applicationId },
        data: {
          domain,
          techStackVersion: version || undefined,
          metadata: metadataUpdate,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Metadata collected for application ${app.domain} (${domainType})`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to collect metadata for ${app.domain}: ${err.message}`);
      throw error;
    }
  }
  /**
   * Detect tech stack on-demand by checking indicator files
   */
  private async detectTechStackOnDemand(serverId: string, path: string): Promise<string> {
    this.logger.log(`Detecting tech stack for ${path}`);

    // Check for WordPress
    const wpConfigCmd = `test -f ${path}/wp-config.php && echo "found" || echo "not found"`;
    const wpConfigResult = await this.sshExecutor.executeCommand(serverId, wpConfigCmd);
    if (wpConfigResult.includes('found')) {
      return 'WORDPRESS';
    }

    // Check for Laravel
    const artisanCmd = `test -f ${path}/artisan && test -f ${path}/composer.json && echo "found" || echo "not found"`;
    const artisanResult = await this.sshExecutor.executeCommand(serverId, artisanCmd);
    if (artisanResult.includes('found')) {
      return 'LARAVEL';
    }

    // Check for Next.js
    const nextConfigCmd = `test -f ${path}/next.config.js -o -f ${path}/next.config.ts && echo "found" || echo "not found"`;
    const nextConfigResult = await this.sshExecutor.executeCommand(serverId, nextConfigCmd);
    if (nextConfigResult.includes('found')) {
      return 'NEXTJS';
    }

    // Check for Node.js/Express
    const packageJsonCmd = `test -f ${path}/package.json && echo "found" || echo "not found"`;
    const packageJsonResult = await this.sshExecutor.executeCommand(serverId, packageJsonCmd);
    if (packageJsonResult.includes('found')) {
      return 'NODEJS';
    }

    // Default to PHP_GENERIC for cPanel
    return 'PHP_GENERIC';
  }

  /**
   * Extract domain from cPanel userdata
   * Returns domain and type (main, subdomain, addon)
   */
  private async extractDomainFromCPanel(
    serverId: string,
    path: string,
    username: string,
  ): Promise<{ domain: string; type: 'main' | 'subdomain' | 'addon' } | null> {
    try {
      // Get primary domain for user
      const primaryDomainCmd = `grep "^DNS=" /var/cpanel/users/${username} 2>/dev/null | cut -d= -f2`;
      const primaryDomainResult = await this.sshExecutor.executeCommand(serverId, primaryDomainCmd);
      const primaryDomain = primaryDomainResult?.trim();

      if (!primaryDomain) {
        this.logger.warn(`Could not find primary domain for user ${username}`);
        return null;
      }

      // Check if path is the main domain's public_html
      if (path === `/home/${username}/public_html`) {
        return { domain: primaryDomain, type: 'main' };
      }

      // Search userdata files for matching document root
      const searchCmd = `grep -l "^documentroot: ${path}" /var/cpanel/userdata/${username}/* 2>/dev/null | head -1`;
      const userdataFile = await this.sshExecutor.executeCommand(serverId, searchCmd);

      if (userdataFile && userdataFile.trim()) {
        const filename = userdataFile.trim().split('/').pop();
        
        // Skip cache and SSL files
        if (filename && !filename.includes('cache') && !filename.includes('_SSL') && !filename.endsWith('.json')) {
          const domain = filename;
          
          // Determine type
          if (domain === primaryDomain) {
            return { domain, type: 'main' };
          } else if (domain.endsWith(`.${primaryDomain}`)) {
            return { domain, type: 'subdomain' };
          } else {
            return { domain, type: 'addon' };
          }
        }
      }

      // Fallback: guess from path
      const pathParts = path.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      
      // Check if it looks like a domain
      if (lastPart && lastPart.includes('.')) {
        if (lastPart.endsWith(`.${primaryDomain}`)) {
          return { domain: lastPart, type: 'subdomain' };
        } else {
          return { domain: lastPart, type: 'addon' };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to extract domain from cPanel: ${error}`);
      return null;
    }
  }

  /**
   * Detect subdomains, addon domains, and parked domains for a cPanel user
   * COPIED from WordPress healer's detectSubdomains method
   * Returns list of related domains with their paths and types
   */
  private async detectSubdomainsAndAddons(
    serverId: string,
    username: string,
    mainDomain: string,
  ): Promise<Array<{ domain: string; path: string; type: 'main' | 'subdomain' | 'addon' | 'parked' }>> {
    try {
      // OPTIMIZED: Single command to get primary domain and parse all domain files
      const batchCommand = `
        PRIMARY=$(grep "^DNS=" /var/cpanel/users/${username} 2>/dev/null | cut -d= -f2 || echo "${mainDomain}");
        echo "PRIMARY:$PRIMARY";
        for file in /var/cpanel/userdata/${username}/*; do
          filename=$(basename "$file");
          if [[ "$filename" == "cache" || "$filename" == "main" || "$filename" == *.json || "$filename" == *_SSL ]]; then
            continue;
          fi;
          if [[ "$filename" != *.* ]]; then
            continue;
          fi;
          docroot=$(grep "^documentroot:" "$file" 2>/dev/null | head -1 | cut -d: -f2- | xargs);
          servername=$(grep "^servername:" "$file" 2>/dev/null | head -1 | cut -d: -f2- | xargs);
          if [[ -n "$docroot" && -n "$servername" ]]; then
            echo "DOMAIN:$servername|$docroot";
          fi;
        done
      `.replace(/\n\s+/g, ' ');

      const result = await this.sshExecutor.executeCommand(serverId, batchCommand);

      if (!result || !result.trim()) {
        this.logger.log(`No domain data returned for ${username}`);
        return [];
      }

      const lines = result.trim().split('\n');
      let primaryDomain = mainDomain;
      const detectedDomains = [];

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('PRIMARY:')) {
          primaryDomain = trimmed.substring(8).trim() || mainDomain;
          this.logger.log(`Primary domain for ${username}: ${primaryDomain}`);
          continue;
        }

        if (trimmed.startsWith('DOMAIN:')) {
          const domainData = trimmed.substring(7);
          const [serverName, documentRoot] = domainData.split('|');

          if (!serverName || !documentRoot) {
            continue;
          }

          // Classify domain type
          let domainType: 'main' | 'subdomain' | 'addon' | 'parked';

          if (serverName === primaryDomain) {
            domainType = 'main';
          } else if (serverName.endsWith(`.${primaryDomain}`) && serverName !== primaryDomain) {
            domainType = 'subdomain';
          } else if (documentRoot === `/home/${username}/public_html`) {
            // Parked domain points to same location as main domain
            domainType = 'parked';
          } else {
            domainType = 'addon';
          }

          detectedDomains.push({
            domain: serverName,
            path: documentRoot,
            type: domainType,
          });

          this.logger.log(`Detected ${domainType}: ${serverName} -> ${documentRoot}`);
        }
      }

      if (detectedDomains.length === 0) {
        this.logger.log(`No domains found for ${mainDomain}`);
        return [];
      }

      this.logger.log(`Total detected domains: ${detectedDomains.length} (main: ${detectedDomains.filter(d => d.type === 'main').length}, subdomain: ${detectedDomains.filter(d => d.type === 'subdomain').length}, addon: ${detectedDomains.filter(d => d.type === 'addon').length}, parked: ${detectedDomains.filter(d => d.type === 'parked').length})`);

      return detectedDomains;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to detect subdomains and addons: ${err.message}`);
      return [];
    }
  }

  /**
   * Update subdomain metadata
   */
  async updateSubdomainMetadata(
    applicationId: string,
    subdomain: string,
    data: {
      techStack?: TechStack;
      version?: string;
      phpVersion?: string;
      healthScore?: number;
      healthStatus?: string;
      isHealerEnabled?: boolean;
      healingMode?: any;
    },
  ) {
    this.logger.log(`Updating metadata for subdomain ${subdomain} of application ${applicationId}`);

    const application = await this.findOne(applicationId);
    const metadata = (application.metadata as any) || {};
    const availableSubdomains = metadata.availableSubdomains || [];

    // Find the subdomain
    const subdomainIndex = availableSubdomains.findIndex((s: any) => s.domain === subdomain);

    if (subdomainIndex === -1) {
      throw new NotFoundException(`Subdomain ${subdomain} not found for application ${applicationId}`);
    }

    // Update subdomain data
    availableSubdomains[subdomainIndex] = {
      ...availableSubdomains[subdomainIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Save back to database
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        metadata: {
          ...metadata,
          availableSubdomains,
        },
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Updated subdomain ${subdomain} metadata`);

    return {
      applicationId,
      subdomain,
      message: 'Subdomain metadata updated successfully',
      data: availableSubdomains[subdomainIndex],
    };
  }

  /**
   * Toggle subdomain healer
   */
  async toggleSubdomainHealer(
    applicationId: string,
    subdomain: string,
    enabled: boolean,
  ) {
    this.logger.log(`${enabled ? 'Enabling' : 'Disabling'} healer for subdomain ${subdomain} of application ${applicationId}`);

    const application = await this.findOne(applicationId);
    const metadata = (application.metadata as any) || {};
    const availableSubdomains = metadata.availableSubdomains || [];

    // Find the subdomain
    const subdomainIndex = availableSubdomains.findIndex((s: any) => s.domain === subdomain);

    if (subdomainIndex === -1) {
      throw new NotFoundException(`Subdomain ${subdomain} not found for application ${applicationId}`);
    }

    // Update healer status
    availableSubdomains[subdomainIndex] = {
      ...availableSubdomains[subdomainIndex],
      isHealerEnabled: enabled,
      updatedAt: new Date().toISOString(),
    };

    // Save back to database
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        metadata: {
          ...metadata,
          availableSubdomains,
        },
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Healer ${enabled ? 'enabled' : 'disabled'} for subdomain ${subdomain}`);

    return {
      applicationId,
      subdomain,
      isHealerEnabled: enabled,
      message: `Healer ${enabled ? 'enabled' : 'disabled'} successfully`,
    };
  }

  /**
   * Get subdomain-specific diagnostics
   * Filters diagnostic results by subdomain
   */
  async getSubdomainDiagnostics(
    applicationId: string,
    subdomain: string,
    limit: number = 50,
  ) {
    this.logger.log(`Getting diagnostics for subdomain ${subdomain} of application ${applicationId}`);

    const application = await this.findOne(applicationId);
    const metadata = (application.metadata as any) || {};
    const availableSubdomains = metadata.availableSubdomains || [];

    // Find the subdomain
    const subdomainInfo = availableSubdomains.find((s: any) => s.domain === subdomain);

    if (!subdomainInfo) {
      throw new NotFoundException(`Subdomain ${subdomain} not found for application ${applicationId}`);
    }

    // Get diagnostic results filtered by subdomain
    const results = await this.prisma.diagnostic_results.findMany({
      where: { 
        applicationId,
        subdomain, // Filter by subdomain field
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    this.logger.log(`Found ${results.length} diagnostic results for subdomain ${subdomain}`);

    return results;
  }

  /**
   * Calculate health score for a specific subdomain
   * Uses same algorithm as main application but filters by subdomain
   */
  async calculateSubdomainHealthScore(
    applicationId: string,
    subdomain: string,
  ): Promise<number> {
    this.logger.log(`Calculating health score for subdomain ${subdomain}`);

    const results = await this.prisma.diagnostic_results.findMany({
      where: { 
        applicationId,
        subdomain,
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Consider last 50 checks
    });

    if (results.length === 0) {
      this.logger.log(`No diagnostic results found for subdomain ${subdomain}, returning 0`);
      return 0;
    }

    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of results) {
      // Weight by severity (risk level)
      let weight = 1;
      switch (result.severity) {
        case 'CRITICAL':
          weight = 4;
          break;
        case 'HIGH':
          weight = 3;
          break;
        case 'MEDIUM':
          weight = 2;
          break;
        case 'LOW':
          weight = 1;
          break;
      }

      totalWeight += weight;

      // Score by status
      if (result.status === 'PASS') {
        weightedScore += weight * 100;
      } else if (result.status === 'WARN') {
        weightedScore += weight * 50;
      }
      // FAIL or ERROR = 0 points
    }

    const healthScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Update subdomain metadata with new health score
    await this.updateSubdomainMetadata(applicationId, subdomain, {
      healthScore,
      healthStatus: this.getHealthStatusFromScore(healthScore),
    });

    this.logger.log(`Health score for subdomain ${subdomain}: ${healthScore}%`);

    return healthScore;
  }

  /**
   * Get health status from health score
   */
  /**
   * Detect tech stack for a specific application
   * Can be called manually or automatically
   */
  async detectTechStack(applicationId: string): Promise<{
    techStack: TechStack;
    version?: string;
    confidence: number;
    metadata?: any;
  }> {
    this.logger.log(`Detecting tech stack for application ${applicationId}`);

    const application = await this.findOne(applicationId);
    const server = await this.prisma.servers.findUnique({
      where: { id: application.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${application.serverId} not found`);
    }

    // Use tech stack detector service
    const detection = await this.techStackDetector.detectTechStack(
      server,
      application.path,
    );

    // Update application with detected tech stack
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        techStack: detection.techStack as TechStack,
        techStackVersion: detection.version,
        detectionConfidence: detection.confidence,
        detectionMethod: DetectionMethod.AUTO,
        metadata: {
          ...(application.metadata as any),
          detectionDetails: detection.metadata,
          lastDetectionAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Tech stack detected: ${detection.techStack} (confidence: ${detection.confidence})`,
    );

    return {
      techStack: detection.techStack as TechStack,
      version: detection.version,
      confidence: detection.confidence,
      metadata: detection.metadata,
    };
  }

  /**
   * Detect tech stack for a specific subdomain
   */
  async detectSubdomainTechStack(
    applicationId: string,
    subdomain: string,
  ): Promise<{
    techStack: TechStack;
    version?: string;
    confidence: number;
  }> {
    this.logger.log(`Detecting tech stack for subdomain ${subdomain}`);

    const application = await this.findOne(applicationId);
    const server = await this.prisma.servers.findUnique({
      where: { id: application.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${application.serverId} not found`);
    }

    // Find subdomain in metadata
    const subdomains = (application.metadata as any)?.availableSubdomains || [];
    const subdomainInfo = subdomains.find((s: any) => s.domain === subdomain);

    if (!subdomainInfo) {
      throw new NotFoundException(
        `Subdomain ${subdomain} not found for application ${applicationId}`,
      );
    }

    // Detect tech stack for subdomain path
    const detection = await this.techStackDetector.detectTechStack(
      server,
      subdomainInfo.path,
    );

    // Update subdomain metadata with detected tech stack
    const subdomainUpdate: any = {
      techStack: detection.techStack as TechStack,
      version: detection.version,
      detectionConfidence: detection.confidence,
      lastDetectionAt: new Date().toISOString(),
    };
    
    await this.updateSubdomainMetadata(applicationId, subdomain, subdomainUpdate);

    this.logger.log(
      `Subdomain tech stack detected: ${detection.techStack} (confidence: ${detection.confidence})`,
    );

    return {
      techStack: detection.techStack as TechStack,
      version: detection.version,
      confidence: detection.confidence,
    };
  }

  /**
   * Detect tech stack for application and all its subdomains
   */
  async detectAllTechStacks(applicationId: string): Promise<{
    main: {
      techStack: TechStack;
      version?: string;
      confidence: number;
    };
    subdomains: Array<{
      domain: string;
      techStack: TechStack;
      version?: string;
      confidence: number;
    }>;
  }> {
    this.logger.log(`Detecting tech stack for application ${applicationId} and all subdomains`);

    const application = await this.findOne(applicationId);
    const server = await this.prisma.servers.findUnique({
      where: { id: application.serverId },
    });

    if (!server) {
      throw new NotFoundException(`Server ${application.serverId} not found`);
    }

    // Detect main application tech stack
    const mainDetection = await this.techStackDetector.detectTechStack(
      server,
      application.path,
    );

    // Update main application
    await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        techStack: mainDetection.techStack as TechStack,
        techStackVersion: mainDetection.version,
        detectionConfidence: mainDetection.confidence,
        detectionMethod: DetectionMethod.AUTO,
        metadata: {
          ...(application.metadata as any),
          detectionDetails: mainDetection.metadata,
          lastDetectionAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Main application tech stack detected: ${mainDetection.techStack} (confidence: ${mainDetection.confidence})`,
    );

    // Detect subdomains tech stacks
    const subdomains = (application.metadata as any)?.availableSubdomains || [];
    const subdomainResults = [];

    for (const subdomainInfo of subdomains) {
      try {
        this.logger.log(`Detecting tech stack for subdomain ${subdomainInfo.domain}`);
        
        const detection = await this.techStackDetector.detectTechStack(
          server,
          subdomainInfo.path,
        );

        // Update subdomain metadata
        const subdomainUpdate: any = {
          techStack: detection.techStack as TechStack,
          version: detection.version,
          detectionConfidence: detection.confidence,
          lastDetectionAt: new Date().toISOString(),
        };
        
        await this.updateSubdomainMetadata(applicationId, subdomainInfo.domain, subdomainUpdate);

        subdomainResults.push({
          domain: subdomainInfo.domain,
          techStack: detection.techStack as TechStack,
          version: detection.version,
          confidence: detection.confidence,
        });

        this.logger.log(
          `Subdomain ${subdomainInfo.domain} tech stack detected: ${detection.techStack} (confidence: ${detection.confidence})`,
        );
      } catch (error) {
        this.logger.error(`Failed to detect tech stack for subdomain ${subdomainInfo.domain}:`, error);
        // Continue with other subdomains even if one fails
      }
    }

    return {
      main: {
        techStack: mainDetection.techStack as TechStack,
        version: mainDetection.version,
        confidence: mainDetection.confidence,
      },
      subdomains: subdomainResults,
    };
  }

  private getHealthStatusFromScore(healthScore: number): string {
    if (healthScore >= 90) {
      return 'HEALTHY';
    } else if (healthScore >= 70) {
      return 'DEGRADED';
    } else if (healthScore >= 50) {
      return 'DOWN';
    } else {
      return 'DOWN';
    }
  }

  /**
   * Public method to detect subdomains and addon domains for an application
   * Used by subdomain detection processor
   */
  async detectSubdomainsForApplication(applicationId: string): Promise<{
    subdomains: Array<{ domain: string; path: string; type: string }>;
    addonDomains: Array<{ domain: string; path: string; type: string }>;
    parkedDomains: Array<{ domain: string; path: string; type: string }>;
  }> {
    this.logger.log(`Detecting subdomains for application ${applicationId}`);

    // Get application details
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: {
        servers: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // Extract username from path (assuming cPanel structure: /home/username/...)
    const pathParts = application.path.split('/');
    const username = pathParts.length >= 3 && pathParts[1] === 'home' ? pathParts[2] : null;

    if (!username) {
      this.logger.warn(`Could not extract username from path: ${application.path}`);
      return { subdomains: [], addonDomains: [], parkedDomains: [] };
    }

    // Detect all related domains
    const allDomains = await this.detectSubdomainsAndAddons(
      application.serverId,
      username,
      application.domain,
    );

    // Categorize domains
    const subdomains = allDomains.filter(d => d.type === 'subdomain');
    const addonDomains = allDomains.filter(d => d.type === 'addon');
    const parkedDomains = allDomains.filter(d => d.type === 'parked');

    this.logger.log(
      `Detected for ${application.domain}: ${subdomains.length} subdomains, ${addonDomains.length} addon domains, ${parkedDomains.length} parked domains`,
    );

    return {
      subdomains,
      addonDomains,
      parkedDomains,
    };
  }

}
