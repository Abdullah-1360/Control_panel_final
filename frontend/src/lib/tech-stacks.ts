/**
 * Tech Stack Configuration
 * 
 * Metadata for all supported tech stacks
 */

import { TechStack, type TechStackInfo } from '@/types/healer';

export const TECH_STACKS: Record<TechStack, TechStackInfo> = {
  [TechStack.WORDPRESS]: {
    value: TechStack.WORDPRESS,
    label: 'WordPress',
    name: 'WordPress',
    icon: 'Globe',
    color: 'bg-blue-500',
    isAvailable: true,
    comingSoon: false,
  },
  [TechStack.NODEJS]: {
    value: TechStack.NODEJS,
    label: 'Node.js',
    name: 'Node.js',
    icon: 'Hexagon',
    color: 'bg-green-500',
    isAvailable: true,
    comingSoon: false,
  },
  [TechStack.PHP_GENERIC]: {
    value: TechStack.PHP_GENERIC,
    label: 'PHP',
    name: 'PHP',
    icon: 'Code',
    color: 'bg-purple-500',
    isAvailable: true,
    comingSoon: false,
  },
  [TechStack.LARAVEL]: {
    value: TechStack.LARAVEL,
    label: 'Laravel',
    name: 'Laravel',
    icon: 'Flame',
    color: 'bg-red-500',
    isAvailable: true,
    comingSoon: false,
  },
  [TechStack.NEXTJS]: {
    value: TechStack.NEXTJS,
    label: 'Next.js',
    name: 'Next.js',
    icon: 'Triangle',
    color: 'bg-black',
    isAvailable: true,
    comingSoon: false,
  },
  [TechStack.EXPRESS]: {
    value: TechStack.EXPRESS,
    label: 'Express',
    name: 'Express',
    icon: 'Zap',
    color: 'bg-gray-500',
    isAvailable: true,
    comingSoon: false,
  },
};

export const getAvailableTechStacks = (): TechStackInfo[] => {
  return Object.values(TECH_STACKS).filter(stack => stack.isAvailable);
};

export const getAllTechStacks = (): TechStackInfo[] => {
  return Object.values(TECH_STACKS);
};

export const getTechStackInfo = (techStack: TechStack): TechStackInfo => {
  return TECH_STACKS[techStack];
};
