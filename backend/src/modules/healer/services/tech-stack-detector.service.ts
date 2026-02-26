/**
 * Tech Stack Detection Service
 * 
 * Automatically detects the tech stack of an application
 */

import { Injectable, Logger } from '@nestjs/common';
import { TechStack, DetectionMethod } from '@prisma/client';
import { DetectionResult } from '../core/interfaces';
import { PluginRegistryService } from './plugin-registry.service';

@Injectable()
export class TechStackDetectorService {
  private readonly logger = new Logger(TechStackDetectorService.name);
  
  constructor(private readonly pluginRegistry: PluginRegistryService) {}
  
  /**
   * Detect the tech stack of an application
   * Runs all plugin detectors and returns the highest confidence match
   */
  async detect(server: any, path: string): Promise<DetectionResult> {
    this.logger.log(`Detecting tech stack for ${path} on server ${server.host}`);
    
    const plugins = this.pluginRegistry.getAllPlugins();
    const results: DetectionResult[] = [];
    
    // Run all plugin detectors in parallel
    const detectionPromises = plugins.map(async (plugin) => {
      try {
        const result = await plugin.detect(server, path);
        if (result.detected) {
          this.logger.debug(
            `Plugin ${plugin.name} detected ${result.techStack} with ${(result.confidence * 100).toFixed(1)}% confidence`,
          );
          return result;
        }
        return null;
      } catch (error: any) {
        this.logger.error(`Plugin ${plugin.name} detection failed: ${error.message}`);
        return null;
      }
    });
    
    const detectionResults = await Promise.all(detectionPromises);
    
    // Filter out null results
    const validResults = detectionResults.filter(
      (result): result is DetectionResult => result !== null,
    );
    
    if (validResults.length === 0) {
      this.logger.warn(`No tech stack detected for ${path}`);
      return {
        detected: false,
        confidence: 0,
      };
    }
    
    // Sort by confidence (highest first)
    validResults.sort((a, b) => b.confidence - a.confidence);
    
    const bestMatch = validResults[0];
    
    this.logger.log(
      `Detected ${bestMatch.techStack} with ${(bestMatch.confidence * 100).toFixed(1)}% confidence`,
    );
    
    return bestMatch;
  }
  
  /**
   * Detect tech stack with manual override option
   */
  async detectWithOverride(
    server: any,
    path: string,
    manualTechStack?: TechStack,
  ): Promise<{
    result: DetectionResult;
    method: DetectionMethod;
  }> {
    // If manual tech stack is provided, use it
    if (manualTechStack) {
      const plugin = this.pluginRegistry.getPlugin(manualTechStack);
      if (!plugin) {
        throw new Error(`Plugin for ${manualTechStack} not available`);
      }
      
      // Verify the manual selection
      const verificationResult = await plugin.detect(server, path);
      
      return {
        result: {
          detected: true,
          techStack: manualTechStack,
          confidence: verificationResult.detected ? 1.0 : 0.5,
          version: verificationResult.version,
          metadata: verificationResult.metadata,
        },
        method: DetectionMethod.MANUAL,
      };
    }
    
    // Otherwise, auto-detect
    const result = await this.detect(server, path);
    
    return {
      result,
      method: DetectionMethod.AUTO,
    };
  }
  
  /**
   * Re-detect tech stack for an existing application
   * Useful when application has been updated or detection was incorrect
   */
  async redetect(application: any, server: any): Promise<DetectionResult> {
    this.logger.log(`Re-detecting tech stack for application ${application.id}`);
    return this.detect(server, application.path);
  }
}
