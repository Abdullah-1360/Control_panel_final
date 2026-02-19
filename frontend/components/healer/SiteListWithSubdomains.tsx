'use client';

import { useState } from 'react';
import { SiteCard } from './SiteCard';
import { SubdomainCard } from './SubdomainCard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Site {
  id: string;
  domain: string;
  path: string;
  healthStatus: string;
  wpVersion?: string;
  phpVersion?: string;
  lastHealthCheck?: string;
  cPanelUsername?: string;
  server: {
    id: string;
    host: string;
  };
}

interface SiteListWithSubdomainsProps {
  data: any;
  isLoading: boolean;
  error: any;
  page: number;
  onPageChange: (page: number) => void;
}

interface DomainGroup {
  mainDomain: Site;
  subdomains: Site[];
  addonDomains: Site[];
}

export function SiteListWithSubdomains({
  data,
  isLoading,
  error,
  page,
  onPageChange,
}: SiteListWithSubdomainsProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Error loading sites: {error.message}
      </div>
    );
  }

  // Handle both old and new data formats
  const sites: Site[] = data?.data || data || [];
  const pagination = data?.pagination;

  if (sites.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No sites found. Click "Discover Sites" to scan your servers.
      </div>
    );
  }

  // Group sites by main domain
  const domainGroups = groupSitesByDomain(sites);

  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain);
    } else {
      newExpanded.add(domain);
    }
    setExpandedDomains(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Sites Grid with Hierarchy */}
      <div className="space-y-4">
        {domainGroups.map((group) => {
          const hasSubdomains = group.subdomains.length > 0 || group.addonDomains.length > 0;
          const isExpanded = expandedDomains.has(group.mainDomain.domain);

          return (
            <div key={group.mainDomain.id} className="space-y-2">
              {/* Main Domain Card */}
              <div className="flex gap-2">
                {hasSubdomains && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2"
                    onClick={() => toggleDomain(group.mainDomain.domain)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <div className={cn('flex-1', !hasSubdomains && 'ml-10')}>
                  <SiteCard
                    site={group.mainDomain}
                    onDiagnose={(id) => window.location.href = `/healer/sites/${id}`}
                    isMainDomain={true}
                    subdomainCount={group.subdomains.length + group.addonDomains.length}
                  />
                </div>
              </div>

              {/* Subdomains (Collapsed/Expanded) */}
              {hasSubdomains && isExpanded && (
                <div className="ml-12 space-y-2 border-l-2 border-muted pl-4">
                  {group.subdomains.map((subdomain) => (
                    <SubdomainCard
                      key={subdomain.id}
                      site={subdomain}
                      onDiagnose={(id) => window.location.href = `/healer/sites/${id}`}
                      type="SUBDOMAIN"
                    />
                  ))}
                  {group.addonDomains.map((addon) => (
                    <SubdomainCard
                      key={addon.id}
                      site={addon}
                      onDiagnose={(id) => window.location.href = `/healer/sites/${id}`}
                      type="ADDON"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} sites
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Group sites by main domain, detecting subdomains and addon domains
 */
function groupSitesByDomain(sites: Site[]): DomainGroup[] {
  const groups = new Map<string, DomainGroup>();

  // First pass: identify main domains
  for (const site of sites) {
    const domainParts = site.domain.split('.');
    
    // Main domain: matches cPanel username or has 2 parts (domain.com)
    const isMainDomain = 
      site.domain === site.cPanelUsername ||
      site.domain.startsWith(`${site.cPanelUsername}.`) ||
      domainParts.length === 2;

    if (isMainDomain) {
      groups.set(site.domain, {
        mainDomain: site,
        subdomains: [],
        addonDomains: [],
      });
    }
  }

  // Second pass: categorize subdomains and addon domains
  for (const site of sites) {
    // Skip if already a main domain
    if (groups.has(site.domain)) continue;

    const domainParts = site.domain.split('.');
    
    // Check if it's a subdomain of any main domain
    let foundParent = false;
    for (const [mainDomain, group] of groups.entries()) {
      if (site.domain.endsWith(`.${mainDomain}`)) {
        // It's a subdomain
        group.subdomains.push(site);
        foundParent = true;
        break;
      }
    }

    // If no parent found and has same cPanel user, it's an addon domain
    if (!foundParent) {
      // Find main domain with same cPanel username
      for (const [mainDomain, group] of groups.entries()) {
        if (group.mainDomain.cPanelUsername === site.cPanelUsername) {
          group.addonDomains.push(site);
          foundParent = true;
          break;
        }
      }
    }

    // If still no parent, create a new main domain group
    if (!foundParent) {
      groups.set(site.domain, {
        mainDomain: site,
        subdomains: [],
        addonDomains: [],
      });
    }
  }

  return Array.from(groups.values());
}
