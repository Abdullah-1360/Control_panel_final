/**
 * Base class for all tech stack plugins
 * 
 * Provides common functionality and enforces plugin interface
 */

import { TechStack } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  IStackPlugin,
  DetectionResult,
  IDiagnosticCheck,
  IHealingStrategy,
  IBackupStrategy,
} from './interfaces';

export abstract class StackPluginBase implements IStackPlugin {
  protected readonly logger = new Logger(this.constructor.name);
  
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supportedVersions: string[];
  abstract readonly techStack: TechStack;
  
  /**
   * Detect if this tech stack is present at the given path
   */
  abstract detect(server: any, path: string): Promise<DetectionResult>;
  
  /**
   * Get all diagnostic checks for this tech stack
   */
  abstract getDiagnosticChecks(): IDiagnosticCheck[];
  
  /**
   * Get all healing strategies for this tech stack
   */
  abstract getHealingStrategies(): IHealingStrategy[];
  
  /**
   * Get the backup strategy for this tech stack
   */
  abstract getBackupStrategy(): IBackupStrategy;
  
  /**
   * Lifecycle hook: called when plugin is loaded
   */
  async onPluginLoad(): Promise<void> {
    this.logger.log(`Plugin ${this.name} v${this.version} loaded`);
  }
  
  /**
   * Lifecycle hook: called when plugin is unloaded
   */
  async onPluginUnload(): Promise<void> {
    this.logger.log(`Plugin ${this.name} v${this.version} unloaded`);
  }
  
  /**
   * Helper method to create a detection result
   */
  protected createDetectionResult(
    detected: boolean,
    confidence: number,
    version?: string,
    metadata?: Record<string, any>,
  ): DetectionResult {
    return {
      detected,
      techStack: detected ? this.techStack : undefined,
      version,
      confidence,
      metadata,
    };
  }
}
