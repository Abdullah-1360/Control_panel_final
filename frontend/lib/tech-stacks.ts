/**
 * Tech Stack Configuration
 * 
 * Metadata for all supported tech stacks
 */

import { TechStack, type TechStackInfo } from '@/types/healer';

export const TECH_STACKS: Record<TechStack, TechStackInfo> = {
  [TechStack.UNKNOWN]: {
    name: 'Unknown',
    value: TechStack.UNKNOWN,
    label: 'Unknown',
    icon: 'HelpCircle',
    color: 'bg-gray-400',
    isAvailable: true,
    available: true,
    comingSoon: false,
  },
  [TechStack.WORDPRESS]: {
    name: 'WordPress',
    value: TechStack.WORDPRESS,
    label: 'WordPress',
    icon: 'Globe',
    color: 'bg-blue-500',
    isAvailable: true,
    available: true,
    comingSoon: false,
  },
  [TechStack.NODEJS]: {
    name: 'Node.js',
    value: TechStack.NODEJS,
    label: 'Node.js',
    icon: 'Hexagon',
    color: 'bg-green-500',
    isAvailable: false,
    available: false,
    comingSoon: true,
  },
  [TechStack.PHP]: {
    name: 'PHP',
    value: TechStack.PHP,
    label: 'PHP',
    icon: 'Code',
    color: 'bg-purple-500',
    isAvailable: false,
    available: false,
    comingSoon: true,
  },
  [TechStack.PHP_GENERIC]: {
    name: 'PHP (Generic)',
    value: TechStack.PHP_GENERIC,
    label: 'PHP (Generic)',
    icon: 'FileCode',
    color: 'bg-purple-400',
    isAvailable: true,
    available: true,
    comingSoon: false,
  },
  [TechStack.LARAVEL]: {
    name: 'Laravel',
    value: TechStack.LARAVEL,
    label: 'Laravel',
    icon: 'Flame',
    color: 'bg-red-500',
    isAvailable: false,
    available: false,
    comingSoon: true,
  },
  [TechStack.NEXTJS]: {
    name: 'Next.js',
    value: TechStack.NEXTJS,
    label: 'Next.js',
    icon: 'Triangle',
    color: 'bg-black',
    isAvailable: false,
    available: false,
    comingSoon: true,
  },
  [TechStack.EXPRESS]: {
    name: 'Express',
    value: TechStack.EXPRESS,
    label: 'Express',
    icon: 'Zap',
    color: 'bg-gray-500',
    isAvailable: false,
    available: false,
    comingSoon: true,
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
