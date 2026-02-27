/**
 * Healing Strategy Engine
 * 
 * Determines healing approach based on diagnostic results and healing mode
 */

import { Injectable, Logger } from '@nestjs/common';
import { HealingMode, RiskLevel, CheckStatus } from '@prisma/client';
import { CheckResult, HealingPlan, HealingAction } from '../core/interfaces';
import { PluginRegistryService } from './plugin-registry.service';

interface HealingPlanItem {
  check: CheckResult;
  action: HealingAction;
}

@Injectable()
export class HealingStrategyEngineService {
  private readonly logger = new Logger(HealingStrategyEngineService.name);
  
  constructor(private readonly pluginRegistry: PluginRegistryService) {}
  
  /**
   * Determine healing approach based on diagnostic results and healing mode
   * 
   * MANUAL mode: Never auto-heal (always require approval)
   * SEMI_AUTO mode: Auto-heal LOW risk only
   * FULL_AUTO mode: Auto-heal LOW and MEDIUM risk
   * 
   * HIGH and CRITICAL risk always require approval
   */
  async determineHealingPlan(
    application: any,
    diagnosticResults: CheckResult[],
    healingMode: HealingMode,
  ): Promise<HealingPlan> {
    this.logger.log(
      `Determining healing plan for application ${application.id} in ${healingMode} mode`,
    );
    
    // Get the plugin for this tech stack
    const plugin = this.pluginRegistry.getPlugin(application.techStack);
    if (!plugin) {
      throw new Error(`Plugin for ${application.techStack} not available`);
    }
    
    // Get healing actions from the plugin
    const availableActions = plugin.getHealingActions();
    
    // Filter failed checks
    const failedChecks = diagnosticResults.filter(
      (result) => result.status === CheckStatus.FAIL || result.status === CheckStatus.WARN,
    );
    
    const plan: HealingPlan = {
      autoHeal: [],
      requireApproval: [],
      cannotHeal: [],
    };
    
    // Process each failed check
    for (const check of failedChecks) {
      // Try to match check to healing action
      const matchedAction = this.matchCheckToAction(check, availableActions);
      
      if (!matchedAction) {
        // No healing action available for this check
        this.logger.debug(`No healing action found for check: ${check.checkName}`);
        plan.cannotHeal.push(check);
        continue;
      }
      
      // Determine if this action can be auto-healed based on mode and risk level
      const canAutoHeal = this.canAutoHeal(healingMode, matchedAction.riskLevel);
      
      const planItem: HealingPlanItem = {
        check,
        action: matchedAction,
      };
      
      if (canAutoHeal) {
        this.logger.debug(
          `Auto-heal approved: ${matchedAction.name} (risk: ${matchedAction.riskLevel}, mode: ${healingMode})`,
        );
        plan.autoHeal.push(planItem);
      } else {
        this.logger.debug(
          `Approval required: ${matchedAction.name} (risk: ${matchedAction.riskLevel}, mode: ${healingMode})`,
        );
        plan.requireApproval.push(planItem);
      }
    }
    
    this.logger.log(
      `Healing plan: ${plan.autoHeal.length} auto-heal, ${plan.requireApproval.length} require approval, ${plan.cannotHeal.length} cannot heal`,
    );
    
    return plan;
  }
  
  /**
   * Match a diagnostic check to an appropriate healing action
   * Uses heuristics based on check name, category, and suggested fix
   */
  private matchCheckToAction(
    check: CheckResult,
    availableActions: HealingAction[],
  ): HealingAction | null {
    const checkName = check.checkName.toLowerCase();
    const suggestedFix = (check.suggestedFix || '').toLowerCase();
    
    // Try exact name match first
    for (const action of availableActions) {
      const actionName = action.name.toLowerCase();
      
      // Direct name match (e.g., "npm_audit" check → "npm_audit_fix" action)
      if (checkName.includes(actionName.replace('_fix', '').replace('_strategy', ''))) {
        return action;
      }
      
      // Match based on suggested fix
      if (suggestedFix && suggestedFix.includes(actionName.replace('_', ' '))) {
        return action;
      }
    }
    
    // Try category-based matching
    for (const action of availableActions) {
      const actionName = action.name.toLowerCase();
      
      // Cache-related checks
      if (checkName.includes('cache') && actionName.includes('cache')) {
        return action;
      }
      
      // Permission-related checks
      if (checkName.includes('permission') && actionName.includes('permission')) {
        return action;
      }
      
      // Database-related checks
      if (checkName.includes('database') && actionName.includes('database')) {
        return action;
      }
      
      // Dependency-related checks
      if (checkName.includes('dependencies') && actionName.includes('update')) {
        return action;
      }
      
      // Update-related checks
      if (checkName.includes('update') && actionName.includes('update')) {
        return action;
      }
      
      // Queue-related checks
      if (checkName.includes('queue') && actionName.includes('queue')) {
        return action;
      }
      
      // Process-related checks
      if (checkName.includes('process') && actionName.includes('restart')) {
        return action;
      }
      
      // Build-related checks
      if (checkName.includes('build') && actionName.includes('build')) {
        return action;
      }
    }
    
    // No match found
    return null;
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
  private canAutoHeal(mode: HealingMode, riskLevel: string): boolean {
    // HIGH and CRITICAL always require approval
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      return false;
    }
    
    switch (mode) {
      case HealingMode.MANUAL:
        // Never auto-heal in manual mode
        return false;
        
      case HealingMode.SEMI_AUTO:
        // Only auto-heal LOW risk actions (SUPERVISED mode)
        return riskLevel === 'LOW';
        
      case HealingMode.FULL_AUTO:
        // Auto-heal LOW and MEDIUM risk actions (AUTO mode)
        return riskLevel === 'LOW' || riskLevel === 'MEDIUM';
        
      default:
        return false;
    }
  }
  
  /**
   * Generate a summary of the healing plan for logging/display
   */
  generatePlanSummary(plan: HealingPlan): string {
    const autoHealActions = plan.autoHeal.map((item: any) => item.action.name).join(', ');
    const approvalActions = plan.requireApproval.map((item: any) => item.action.name).join(', ');
    const cannotHealChecks = plan.cannotHeal.map((check: any) => check.checkName).join(', ');
    
    return [
      `Auto-heal (${plan.autoHeal.length}): ${autoHealActions || 'none'}`,
      `Require approval (${plan.requireApproval.length}): ${approvalActions || 'none'}`,
      `Cannot heal (${plan.cannotHeal.length}): ${cannotHealChecks || 'none'}`,
    ].join(' | ');
  }
}
