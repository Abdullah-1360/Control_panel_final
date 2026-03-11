/**
 * Binary Search Plugin Conflict Service
 * 
 * Uses binary search algorithm to quickly identify conflicting plugins
 * Complexity: O(log n) instead of O(n) for linear search
 * 
 * Example: 32 plugins → 5 tests instead of 32 tests
 */

import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from './ssh-executor.service';
import { WpCliService } from './wp-cli.service';

@Injectable()
export class BinarySearchPluginConflictService {
  private readonly logger = new Logger(BinarySearchPluginConflictService.name);
  
  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService
  ) {}
  
  /**
   * Identify conflicting plugin(s) using binary search
   * Returns list of conflicting plugins
   */
  async identifyConflictingPlugin(
    serverId: string,
    sitePath: string
  ): Promise<string[]> {
    this.logger.log('Starting binary search for plugin conflicts...');
    
    // Get all active plugins
    const allPlugins = await this.getActivePlugins(serverId, sitePath);
    
    if (allPlugins.length === 0) {
      this.logger.log('No active plugins found');
      return [];
    }
    
    this.logger.log(`Found ${allPlugins.length} active plugins`);
    
    // Deactivate all plugins
    await this.deactivateAllPlugins(serverId, sitePath);
    
    // Test if site works without plugins
    const worksWithoutPlugins = await this.testSite(serverId, sitePath);
    
    if (!worksWithoutPlugins) {
      this.logger.log('Site still broken without plugins - issue is not plugin-related');
      // Reactivate all plugins
      await this.activatePlugins(serverId, sitePath, allPlugins);
      return [];
    }
    
    this.logger.log('Site works without plugins - starting binary search');
    
    // Binary search to find conflicting plugin(s)
    const conflicting = await this.binarySearchConflict(
      serverId,
      sitePath,
      allPlugins
    );
    
    // Reactivate non-conflicting plugins
    const nonConflicting = allPlugins.filter(p => !conflicting.includes(p));
    if (nonConflicting.length > 0) {
      await this.activatePlugins(serverId, sitePath, nonConflicting);
    }
    
    this.logger.log(`Binary search complete. Found ${conflicting.length} conflicting plugin(s)`);
    
    return conflicting;
  }
  
  /**
   * Binary search algorithm to find conflicting plugins
   */
  private async binarySearchConflict(
    serverId: string,
    sitePath: string,
    plugins: string[]
  ): Promise<string[]> {
    if (plugins.length === 0) {
      return [];
    }
    
    if (plugins.length === 1) {
      // Test single plugin
      await this.activatePlugins(serverId, sitePath, plugins);
      const works = await this.testSite(serverId, sitePath);
      await this.deactivatePlugins(serverId, sitePath, plugins);
      
      return works ? [] : plugins;
    }
    
    // Split plugins in half
    const mid = Math.floor(plugins.length / 2);
    const leftHalf = plugins.slice(0, mid);
    const rightHalf = plugins.slice(mid);
    
    this.logger.log(
      `Testing ${leftHalf.length} plugins (left half) vs ${rightHalf.length} plugins (right half)`
    );
    
    // Test left half
    await this.activatePlugins(serverId, sitePath, leftHalf);
    const leftWorks = await this.testSite(serverId, sitePath);
    await this.deactivatePlugins(serverId, sitePath, leftHalf);
    
    // Test right half
    await this.activatePlugins(serverId, sitePath, rightHalf);
    const rightWorks = await this.testSite(serverId, sitePath);
    await this.deactivatePlugins(serverId, sitePath, rightHalf);
    
    const conflicting: string[] = [];
    
    // Recursively search in halves that don't work
    if (!leftWorks) {
      const leftConflicting = await this.binarySearchConflict(
        serverId,
        sitePath,
        leftHalf
      );
      conflicting.push(...leftConflicting);
    }
    
    if (!rightWorks) {
      const rightConflicting = await this.binarySearchConflict(
        serverId,
        sitePath,
        rightHalf
      );
      conflicting.push(...rightConflicting);
    }
    
    return conflicting;
  }
  
  /**
   * Get list of active plugins
   */
  private async getActivePlugins(
    serverId: string,
    sitePath: string
  ): Promise<string[]> {
    try {
      const output = await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin list --status=active --field=name --skip-themes'
      );
      
      return output.trim().split('\n').filter(p => p.length > 0);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get active plugins: ${err.message}`);
      return [];
    }
  }
  
  /**
   * Deactivate all plugins
   */
  private async deactivateAllPlugins(
    serverId: string,
    sitePath: string
  ): Promise<void> {
    try {
      await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin deactivate --all --skip-plugins --skip-themes'
      );
      
      this.logger.log('Deactivated all plugins');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to deactivate all plugins: ${err.message}`);
      throw error;
    }
  }
  
  /**
   * Activate specific plugins
   */
  private async activatePlugins(
    serverId: string,
    sitePath: string,
    plugins: string[]
  ): Promise<void> {
    if (plugins.length === 0) {
      return;
    }
    
    try {
      const pluginList = plugins.join(' ');
      await this.wpCli.execute(
        serverId,
        sitePath,
        `plugin activate ${pluginList} --skip-plugins --skip-themes`
      );
      
      this.logger.debug(`Activated plugins: ${pluginList}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to activate plugins: ${err.message}`);
      throw error;
    }
  }
  
  /**
   * Deactivate specific plugins
   */
  private async deactivatePlugins(
    serverId: string,
    sitePath: string,
    plugins: string[]
  ): Promise<void> {
    if (plugins.length === 0) {
      return;
    }
    
    try {
      const pluginList = plugins.join(' ');
      await this.wpCli.execute(
        serverId,
        sitePath,
        `plugin deactivate ${pluginList} --skip-plugins --skip-themes`
      );
      
      this.logger.debug(`Deactivated plugins: ${pluginList}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to deactivate plugins: ${err.message}`);
      throw error;
    }
  }
  
  /**
   * Test if site is working
   */
  private async testSite(
    serverId: string,
    sitePath: string
  ): Promise<boolean> {
    try {
      // Get site URL from wp-config.php
      const siteUrl = await this.getSiteUrl(serverId, sitePath);
      
      // Test HTTP response
      const response = await this.sshExecutor.executeCommand(
        serverId,
        `curl -s -o /dev/null -w "%{http_code}" ${siteUrl}`
      );
      
      const statusCode = parseInt(response.trim());
      
      // Consider 200-399 as working
      const works = statusCode >= 200 && statusCode < 400;
      
      this.logger.debug(`Site test: ${siteUrl} → ${statusCode} (${works ? 'WORKS' : 'BROKEN'})`);
      
      return works;
      
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Site test failed: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Get site URL from WordPress
   */
  private async getSiteUrl(
    serverId: string,
    sitePath: string
  ): Promise<string> {
    try {
      const url = await this.wpCli.execute(
        serverId,
        sitePath,
        'option get siteurl --skip-plugins --skip-themes'
      );
      
      return url.trim();
    } catch (error) {
      // Fallback: try to get from wp-config.php
      try {
        const domain = await this.sshExecutor.executeCommand(
          serverId,
          `grep "WP_SITEURL" ${sitePath}/wp-config.php | cut -d "'" -f 4`
        );
        
        if (domain.trim()) {
          return domain.trim();
        }
      } catch (e) {
        // Ignore
      }
      
      // Last resort: use localhost
      return 'http://localhost';
    }
  }
}
