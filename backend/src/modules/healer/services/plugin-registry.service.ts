/**
 * Plugin Registry Service
 * 
 * Manages the lifecycle of tech stack plugins
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TechStack } from '@prisma/client';
import { IStackPlugin, PluginRegistryEntry } from '../core/interfaces';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PluginRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly plugins = new Map<TechStack, PluginRegistryEntry>();
  
  constructor(private readonly prisma: PrismaService) {}
  
  /**
   * Initialize the plugin registry on module load
   */
  async onModuleInit() {
    this.logger.log('Initializing Plugin Registry...');
    await this.loadBuiltInPlugins();
    this.logger.log(`Plugin Registry initialized with ${this.plugins.size} plugins`);
  }
  
  /**
   * Register a plugin
   */
  async registerPlugin(plugin: IStackPlugin): Promise<void> {
    try {
      // Call plugin lifecycle hook
      if (plugin.onPluginLoad) {
        await plugin.onPluginLoad();
      }
      
      // Store in registry
      const entry: PluginRegistryEntry = {
        plugin,
        isEnabled: true,
        loadedAt: new Date(),
        metadata: {
          name: plugin.name,
          version: plugin.version,
          techStack: plugin.techStack,
        },
      };
      
      this.plugins.set(plugin.techStack, entry);
      
      // Store in database
      await this.prisma.tech_stack_plugins.upsert({
        where: { name: plugin.name },
        create: {
          name: plugin.name,
          techStack: plugin.techStack,
          version: plugin.version,
          isEnabled: true,
          isBuiltIn: true,
          configuration: {},
        },
        update: {
          version: plugin.version,
          isEnabled: true,
        },
      });
      
      this.logger.log(`Plugin registered: ${plugin.name} v${plugin.version} (${plugin.techStack})`);
    } catch (error: any) {
      this.logger.error(`Failed to register plugin ${plugin.name}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Unregister a plugin
   */
  async unregisterPlugin(techStack: TechStack): Promise<void> {
    const entry = this.plugins.get(techStack);
    if (!entry) {
      throw new Error(`Plugin for ${techStack} not found`);
    }
    
    // Call plugin lifecycle hook
    if (entry.plugin.onPluginUnload) {
      await entry.plugin.onPluginUnload();
    }
    
    this.plugins.delete(techStack);
    this.logger.log(`Plugin unregistered: ${entry.metadata.name}`);
  }
  
  /**
   * Get a plugin by tech stack
   */
  getPlugin(techStack: TechStack): IStackPlugin | null {
    const entry = this.plugins.get(techStack);
    return entry?.isEnabled ? entry.plugin : null;
  }
  
  /**
   * Get all registered plugins
   */
  getAllPlugins(): IStackPlugin[] {
    return Array.from(this.plugins.values())
      .filter(entry => entry.isEnabled)
      .map(entry => entry.plugin);
  }
  
  /**
   * Get all plugin metadata
   */
  getAllPluginMetadata(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Enable a plugin
   */
  async enablePlugin(techStack: TechStack): Promise<void> {
    const entry = this.plugins.get(techStack);
    if (!entry) {
      throw new Error(`Plugin for ${techStack} not found`);
    }
    
    entry.isEnabled = true;
    
    await this.prisma.tech_stack_plugins.updateMany({
      where: { techStack },
      data: { isEnabled: true },
    });
    
    this.logger.log(`Plugin enabled: ${entry.metadata.name}`);
  }
  
  /**
   * Disable a plugin
   */
  async disablePlugin(techStack: TechStack): Promise<void> {
    const entry = this.plugins.get(techStack);
    if (!entry) {
      throw new Error(`Plugin for ${techStack} not found`);
    }
    
    entry.isEnabled = false;
    
    await this.prisma.tech_stack_plugins.updateMany({
      where: { techStack },
      data: { isEnabled: false },
    });
    
    this.logger.log(`Plugin disabled: ${entry.metadata.name}`);
  }
  
  /**
   * Check if a plugin is registered and enabled
   */
  isPluginAvailable(techStack: TechStack): boolean {
    const entry = this.plugins.get(techStack);
    return entry?.isEnabled ?? false;
  }
  
  /**
   * Load built-in plugins
   * TODO: Import and register actual plugin implementations
   */
  private async loadBuiltInPlugins(): Promise<void> {
    this.logger.log('Loading built-in plugins...');
    
    // Plugins will be registered here as they are implemented
    // Example:
    // await this.registerPlugin(new WordPressPlugin());
    // await this.registerPlugin(new NodeJsPlugin());
    // await this.registerPlugin(new LaravelPlugin());
    
    this.logger.log('Built-in plugins loaded');
  }
}
