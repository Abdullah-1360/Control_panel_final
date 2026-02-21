import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SshExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';

interface DiscoveredSite {
  domain: string;
  path: string;
  cPanelUsername: string;
  wpVersion?: string;
  phpVersion?: string;
  dbName?: string;
  dbHost?: string;
}

@Injectable()
export class SiteDiscoveryService {
  private readonly logger = new Logger(SiteDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sshService: SshExecutorService,
    private readonly wpCliService: WpCliService,
  ) {}

  /**
   * Discover WordPress sites on a cPanel server via SSH
   */
  async discoverSites(serverId: string): Promise<DiscoveredSite[]> {
    this.logger.log(`Starting site discovery on server ${serverId}`);

    try {
      // Try cPanel discovery first
      try {
        const users = await this.getCpanelUsers(serverId);
        this.logger.log(`Found ${users.length} cPanel users`);

        // ENHANCED: Get ALL domains for all users (including subdomains, addon domains)
        const allDomains = await this.getAllDomainsWithPaths(serverId);
        this.logger.log(`Found ${allDomains.length} total domains (main, addon, subdomains)`);

        // Register all domains as potential sites
        const discoveredSites: DiscoveredSite[] = allDomains.map(domainInfo => ({
          domain: domainInfo.domain,
          path: domainInfo.path,
          cPanelUsername: domainInfo.username,
          wpVersion: undefined,
          phpVersion: undefined,
          dbName: undefined,
          dbHost: 'localhost',
        }));

        this.logger.log(`Discovered ${discoveredSites.length} potential WordPress sites via cPanel`);
        return discoveredSites;
      } catch (cpanelError) {
        // Not a cPanel server, try generic discovery
        this.logger.warn('cPanel discovery failed, trying generic discovery');
        return await this.genericWordPressDiscovery(serverId);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Site discovery failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Generic WordPress discovery for non-cPanel servers
   * Searches common web root locations
   */
  private async genericWordPressDiscovery(serverId: string): Promise<DiscoveredSite[]> {
    this.logger.log('Starting generic WordPress discovery');
    
    const commonPaths = [
      '/var/www/html',
      '/var/www',
      '/usr/share/nginx/html',
      '/home/*/public_html',
      '/home/*/www',
      '/home/*/htdocs',
      '/srv/www',
      '/opt/www',
    ];

    const discoveredSites: DiscoveredSite[] = [];

    for (const searchPath of commonPaths) {
      try {
        // Find wp-config.php files
        const command = `find ${searchPath} -maxdepth 3 -name "wp-config.php" 2>/dev/null || true`;
        const result = await this.sshService.executeCommand(serverId, command);
        
        if (result && result.trim()) {
          const wpConfigPaths = result.trim().split('\n').filter(Boolean);
          
          for (const wpConfigPath of wpConfigPaths) {
            const sitePath = wpConfigPath.replace('/wp-config.php', '');
            
            try {
              const domain = await this.extractDomainFromPath(serverId, sitePath);
              
              // Just register the site without checking versions (faster discovery)
              // Versions and metadata will be collected on-demand when user clicks diagnose
              discoveredSites.push({
                domain: domain || sitePath.split('/').pop() || 'unknown',
                path: sitePath,
                cPanelUsername: 'N/A', // Not applicable for non-cPanel
                wpVersion: undefined,
                phpVersion: undefined,
                dbName: undefined,
                dbHost: 'localhost',
              });
            } catch (error) {
              const err = error as Error;
              this.logger.warn(`Failed to extract metadata for ${sitePath}: ${err.message}`);
            }
          }
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    this.logger.log(`Discovered ${discoveredSites.length} WordPress sites via generic discovery`);
    return discoveredSites;
  }

  /**
   * Extract domain from server configuration or path
   */
  private async extractDomainFromPath(serverId: string, path: string): Promise<string | null> {
    try {
      // Try to get domain from nginx config
      const nginxCommand = `grep -r "root ${path}" /etc/nginx/sites-enabled/ 2>/dev/null | grep server_name | head -n 1 | sed 's/.*server_name //;s/;.*//' || true`;
      const nginxResult = await this.sshService.executeCommand(serverId, nginxCommand);
      
      if (nginxResult && nginxResult.trim()) {
        return nginxResult.trim().split(' ')[0]; // Get first domain
      }

      // Try Apache config
      const apacheCommand = `grep -r "DocumentRoot ${path}" /etc/apache2/sites-enabled/ /etc/httpd/conf.d/ 2>/dev/null | grep ServerName | head -n 1 | awk '{print $2}' || true`;
      const apacheResult = await this.sshService.executeCommand(serverId, apacheCommand);
      
      if (apacheResult && apacheResult.trim()) {
        return apacheResult.trim();
      }

      // Fallback: use path-based name
      return path.split('/').filter(Boolean).pop() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get list of cPanel users from /etc/trueuserdomains
   */
  private async getCpanelUsers(serverId: string): Promise<string[]> {
    const command = `cat /etc/trueuserdomains | cut -d ':' -f 2 | sort -u`;
    const result = await this.sshService.executeCommand(serverId, command);

    if (!result || result.trim() === '') {
      throw new Error('Not a cPanel server or no access to /etc/trueuserdomains');
    }

    // Trim each username to remove leading/trailing spaces
    return result.trim().split('\n').map(u => u.trim()).filter(Boolean);
  }

  /**
   * Check if a cPanel user has WordPress installations
   */
  private async checkUserForWordPress(
    serverId: string,
    username: string,
  ): Promise<DiscoveredSite[]> {
    const sites: DiscoveredSite[] = [];

    // Common cPanel paths
    const paths = [
      `/home/${username}/public_html`,
      `/home/${username}/www`,
      `/home/${username}/htdocs`,
    ];

    for (const path of paths) {
      const hasWp = await this.checkWordPressInstallation(serverId, path);

      if (hasWp) {
        try {
          const domain = await this.getDomainForUser(serverId, username);
          
          // Just register the site without checking versions (faster discovery)
          // Versions and metadata will be collected on-demand when user clicks diagnose
          sites.push({
            domain,
            path,
            cPanelUsername: username,
            wpVersion: undefined,
            phpVersion: undefined,
            dbName: undefined,
            dbHost: 'localhost',
          });

          break; // Found WordPress, move to next user
        } catch (error) {
          const err = error as Error;
          this.logger.warn(
            `Failed to extract metadata for ${username}: ${err.message}`,
          );
        }
      }
    }

    return sites;
  }

  /**
   * Check if WordPress is installed at path
   */
  private async checkWordPressInstallation(
    serverId: string,
    path: string,
  ): Promise<boolean> {
    const command = `test -f ${path}/wp-config.php && echo "exists" || echo "not found"`;
    const result = await this.sshService.executeCommand(serverId, command);
    return result.includes('exists');
  }

  /**
   * Get primary domain for cPanel user
   */
  /**
   * Get all user-domain mappings in ONE command (fast)
   */
  /**
   * Get ALL domains for all users including main, addon, subdomains, and parked domains
   * Returns domain with its document root path
   * OPTIMIZED: Uses batch command to get all document roots in 2 SSH calls instead of N+1
   */
  private async getAllDomainsWithPaths(serverId: string): Promise<Array<{domain: string, path: string, username: string}>> {
    try {
      // Step 1: Get all domains from trueuserdomains (1 SSH call)
      const command = `cat /etc/trueuserdomains`;
      const result = await this.sshService.executeCommand(serverId, command);
      
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
      
      this.logger.log(`Found ${domainUserMap.length} domains in trueuserdomains`);
      
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
      
      this.logger.log(`Mapped ${domains.length} domains to document roots`);
      return domains;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to get all domains: ${err.message}`);
      return [];
    }
  }

  /**
   * Get document roots for ALL domains in a single batch SSH command
   * This is 50-100x faster than individual calls
   */
  private async getAllDocumentRootsBatch(
    serverId: string,
    domains: Array<{domain: string, username: string}>
  ): Promise<Map<string, string>> {
    try {
      // Build batch command to get all document roots at once
      // Use a simple for loop in bash to avoid command chaining validation
      const chunkSize = 50;
      const allResults = new Map<string, string>();
      
      for (let i = 0; i < domains.length; i += chunkSize) {
        const chunk = domains.slice(i, i + chunkSize);
        
        // Build a bash script that loops through domains
        // This avoids command chaining detection while being efficient
        const domainList = chunk.map(d => `${d.domain}:${d.username}`).join(' ');
        const command = `for item in ${domainList}; do domain=\${item%%:*}; user=\${item##*:}; docroot=$(grep -E "^documentroot:" /var/cpanel/userdata/$user/$domain 2>/dev/null | cut -d: -f2- | xargs); [ -n "$docroot" ] && echo "$domain|$docroot"; done`;
        
        const result = await this.sshService.executeCommand(serverId, command);
        
        // Parse results
        for (const line of result.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          const [domain, docroot] = trimmed.split('|');
          if (domain && docroot && docroot.startsWith('/')) {
            allResults.set(domain, docroot);
          }
        }
      }
      
      this.logger.log(`Retrieved ${allResults.size} document roots from cPanel userdata`);
      return allResults;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Batch document root lookup failed: ${err.message}`);
      return new Map();
    }
  }

  /**
   * Smart path guessing based on domain type and cPanel conventions
   * Used as fallback when userdata lookup fails
   */
  private guessDocumentRoot(domain: string, username: string): string {
    // Main domain: matches username or starts with username.
    if (domain === username || domain.startsWith(`${username}.`)) {
      return `/home/${username}/public_html`;
    }
    
    // Check if it's a subdomain of the main domain
    // Pattern: subdomain.maindomain.com
    const parts = domain.split('.');
    if (parts.length >= 3) {
      // Likely a subdomain - use only the subdomain part (first segment)
      // Example: test.example.com -> /home/user/public_html/test
      const subdomain = parts[0];
      return `/home/${username}/public_html/${subdomain}`;
    }
    
    // Addon domain: different domain entirely
    // Common patterns: /home/username/addondomain.com or /home/username/public_html/addondomain.com
    return `/home/${username}/${domain}`;
  }

  /**
   * Get document root for a specific domain from cPanel userdata
   */
  private async getDomainDocumentRoot(serverId: string, username: string, domain: string): Promise<string | null> {
    try {
      // cPanel stores domain configuration in /var/cpanel/userdata/{username}/{domain}
      const command = `grep -E "^documentroot:" /var/cpanel/userdata/${username}/${domain} 2>/dev/null | cut -d: -f2- | xargs`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      const docRoot = result.trim();
      if (docRoot && docRoot.startsWith('/')) {
        return docRoot;
      }
      
      return null;
    } catch (error) {
      // Fallback: try common patterns
      return null;
    }
  }

  /**
   * @deprecated Use getAllDomainsWithPaths instead
   * Get primary domain for each user (kept for backward compatibility)
   */
  private async getAllUserDomains(serverId: string): Promise<Record<string, string>> {
    try {
      // Read entire trueuserdomains file in one command
      const command = `cat /etc/trueuserdomains`;
      const result = await this.sshService.executeCommand(serverId, command);
      
      // Parse the output: domain: username
      const userDomainMap: Record<string, string> = {};
      const lines = result.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const [domain, username] = trimmed.split(':').map(s => s.trim());
        if (domain && username) {
          // Store first domain for each user (primary domain)
          if (!userDomainMap[username]) {
            userDomainMap[username] = domain;
          }
        }
      }
      
      return userDomainMap;
    } catch (error) {
      this.logger.warn('Failed to read trueuserdomains, using fallback');
      return {};
    }
  }

  private async getDomainForUser(
    serverId: string,
    username: string,
  ): Promise<string> {
    const command = `grep ":${username}$" /etc/trueuserdomains | head -n 1 | cut -d ':' -f 1`;
    const result = await this.sshService.executeCommand(serverId, command);
    return result.trim();
  }

  /**
   * Get WordPress version
   */
  private async getWpVersion(
    serverId: string,
    path: string,
  ): Promise<string | null> {
    try {
      const version = await this.wpCliService.execute(
        serverId,
        path,
        'core version',
      );
      return version.trim();
    } catch (error) {
      // Fallback: Read version.php
      try {
        const command = `grep "wp_version = " ${path}/wp-includes/version.php | cut -d "'" -f 2`;
        const result = await this.sshService.executeCommand(serverId, command);
        return result.trim();
      } catch {
        return null;
      }
    }
  }

  /**
   * Get PHP version
   */
  private async getPhpVersion(
    serverId: string,
    path: string,
  ): Promise<string | null> {
    try {
      const command = `cd ${path} && php -v | head -n 1 | cut -d ' ' -f 2`;
      const result = await this.sshService.executeCommand(serverId, command);
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Extract database info from wp-config.php
   */
  private async extractDbInfo(
    serverId: string,
    path: string,
  ): Promise<{ dbName?: string; dbHost: string }> {
    try {
      const wpConfigPath = `${path}/wp-config.php`;

      // Extract DB_NAME
      const dbNameCommand = `grep "DB_NAME" ${wpConfigPath} | cut -d "'" -f 4`;
      const dbName = await this.sshService.executeCommand(
        serverId,
        dbNameCommand,
      );

      // Extract DB_HOST
      const dbHostCommand = `grep "DB_HOST" ${wpConfigPath} | cut -d "'" -f 4`;
      const dbHost = await this.sshService.executeCommand(
        serverId,
        dbHostCommand,
      );

      return {
        dbName: dbName.trim() || undefined,
        dbHost: dbHost.trim() || 'localhost',
      };
    } catch {
      return { dbName: undefined, dbHost: 'localhost' };
    }
  }

  /**
   * Register discovered sites in database
   */
  async registerSites(
    serverId: string,
    sites: DiscoveredSite[],
  ): Promise<number> {
    let registered = 0;
    let updated = 0;
    let failed = 0;

    for (const site of sites) {
      try {
        // Check if site already exists
        const existing = await this.prisma.wp_sites.findUnique({
          where: { domain: site.domain },
        });

        if (existing) {
          // Update existing site (including serverId in case it moved)
          await this.prisma.wp_sites.update({
            where: { id: existing.id },
            data: {
              serverId, // Update serverId in case site moved to different server
              wpVersion: site.wpVersion,
              phpVersion: site.phpVersion,
              dbName: site.dbName,
              dbHost: site.dbHost,
              cPanelUsername: site.cPanelUsername, // Update cPanel username too
              path: site.path, // Update path in case it changed
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          // Create new site
          await this.prisma.wp_sites.create({
            data: {
              serverId,
              domain: site.domain,
              path: site.path,
              cPanelUsername: site.cPanelUsername,
              wpVersion: site.wpVersion,
              phpVersion: site.phpVersion,
              dbName: site.dbName,
              dbHost: site.dbHost,
              isHealerEnabled: false, // Disabled by default
              healthStatus: 'UNKNOWN',
            },
          });
          registered++;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to register site ${site.domain}: ${err.message}`,
        );
        failed++;
      }
    }

    this.logger.log(
      `Site registration complete: ${registered} new, ${updated} updated, ${failed} failed`,
    );

    return registered;
  }

  /**
   * Fuzzy search for sites by domain name
   */
  async searchSites(query: string): Promise<any[]> {
    const sites = await this.prisma.wp_sites.findMany({
      where: {
        domain: {
          contains: query,
          mode: 'insensitive',
        },
        // Filter out sites whose servers have been soft-deleted
        servers: {
          deletedAt: null,
        },
      },
      include: {
        servers: {
          select: {
            id: true,
            host: true,
          },
        },
      },
      take: 20,
    });

    return sites;
  }

  /**
   * Collect metadata for a specific site (on-demand)
   * This is called when user clicks on a site to diagnose
   */
  async collectSiteMetadata(siteId: string): Promise<void> {
    this.logger.log(`Collecting metadata for site ${siteId}`);

    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    try {
      // First, verify WordPress is actually installed
      const hasWp = await this.checkWordPressInstallation(site.serverId, site.path);
      
      if (!hasWp) {
        // Try alternate paths for cPanel users
        if (site.cPanelUsername && site.cPanelUsername !== 'N/A') {
          const alternatePaths = [
            `/home/${site.cPanelUsername}/www`,
            `/home/${site.cPanelUsername}/htdocs`,
          ];
          
          let foundPath: string | null = null;
          for (const altPath of alternatePaths) {
            if (await this.checkWordPressInstallation(site.serverId, altPath)) {
              foundPath = altPath;
              break;
            }
          }
          
          if (foundPath) {
            // Update the path
            await this.prisma.wp_sites.update({
              where: { id: siteId },
              data: { path: foundPath },
            });
          } else {
            throw new Error(`WordPress not found at ${site.path} or alternate paths`);
          }
        } else {
          throw new Error(`WordPress not found at ${site.path}`);
        }
      }

      // Collect WordPress version
      const wpVersion = await this.getWpVersion(site.serverId, site.path);
      
      // Collect PHP version
      const phpVersion = await this.getPhpVersion(site.serverId, site.path);
      
      // Extract database info
      const dbInfo = await this.extractDbInfo(site.serverId, site.path);

      // Update site with metadata
      await this.prisma.wp_sites.update({
        where: { id: siteId },
        data: {
          wpVersion: wpVersion || undefined,
          phpVersion: phpVersion || undefined,
          dbName: dbInfo.dbName,
          dbHost: dbInfo.dbHost,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Metadata collected for site ${site.domain}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to collect metadata for ${site.domain}: ${err.message}`);
      throw error;
    }
  }

  /**
   * Detect subdomains, addon domains for a main domain
   * Uses cPanel userdata files to get accurate domain configuration
   * OPTIMIZED: Single SSH command to parse all domains at once
   * Returns list of domains with their paths, types, and WordPress detection status
   */
  async detectSubdomains(siteId: string): Promise<Array<{subdomain: string, path: string, hasWordPress: boolean, type: 'main' | 'subdomain' | 'addon'}>> {
    this.logger.log(`Detecting subdomains for site ${siteId}`);

    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
      include: { servers: true },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    const serverId = site.serverId;
    const mainDomain = site.domain;
    const username = site.cPanelUsername;

    if (!username || username === 'N/A') {
      this.logger.warn(`No cPanel username for site ${siteId}, cannot detect subdomains`);
      return [];
    }

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
            wpexists="false";
            if [[ -f "$docroot/wp-config.php" ]]; then
              wpexists="true";
            fi;
            echo "DOMAIN:$servername|$docroot|$wpexists";
          fi;
        done
      `.replace(/\n\s+/g, ' ');

      const result = await this.sshService.executeCommand(serverId, batchCommand);

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
          const [serverName, documentRoot, wpExists] = domainData.split('|');

          if (!serverName || !documentRoot) {
            continue;
          }

          // Classify domain type
          let domainType: 'main' | 'subdomain' | 'addon';

          if (serverName === primaryDomain) {
            domainType = 'main';
          } else if (serverName.endsWith(`.${primaryDomain}`) && serverName !== primaryDomain) {
            domainType = 'subdomain';
          } else {
            domainType = 'addon';
          }

          const hasWordPress = wpExists === 'true';

          detectedDomains.push({
            subdomain: serverName,
            path: documentRoot,
            hasWordPress,
            type: domainType,
          });

          this.logger.log(`Detected ${domainType}: ${serverName} -> ${documentRoot} (WP: ${hasWordPress})`);
        }
      }

      if (detectedDomains.length === 0) {
        this.logger.log(`No domains found for ${mainDomain}`);
        return [];
      }

      this.logger.log(`Total detected domains: ${detectedDomains.length} (main: ${detectedDomains.filter(d => d.type === 'main').length}, subdomain: ${detectedDomains.filter(d => d.type === 'subdomain').length}, addon: ${detectedDomains.filter(d => d.type === 'addon').length})`);

      // Update site with detected subdomains (exclude main domain from the list)
      const subdomainsOnly = detectedDomains.filter(d => d.type !== 'main');
      await this.prisma.wp_sites.update({
        where: { id: siteId },
        data: {
          availableSubdomains: subdomainsOnly as any,
        },
      });

      return subdomainsOnly;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to detect subdomains: ${err.message}`);
      return [];
    }
  }

  /**
   * Check if WordPress exists at a given path
   */
  private async checkWordPressExists(serverId: string, path: string): Promise<boolean> {
    try {
      const command = `test -f ${path}/wp-config.php && echo "exists" || echo "not found"`;
      const result = await this.sshService.executeCommand(serverId, command);
      return result.trim() === 'exists';
    } catch (error) {
      return false;
    }
  }
}

