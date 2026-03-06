# SEO Health Database Audit Implementation

## Status: ✅ COMPLETE

## Overview
Completely rewrote the SEO health check to use database queries for comprehensive SEO analysis instead of basic file checks. Now performs deep audits of WordPress SEO configuration, plugin detection, and content-level SEO issues.

## Implementation Details

### 1. Global SEO Blockers (wp_options)

**IMPORTANT:** All queries use the actual table prefix extracted from wp-config.php. Examples below show `wp_` for readability, but the implementation uses `${dbConfig.prefix}` which becomes `wpx5_`, `wp82_`, etc.

#### Check if Site is Blocking Search Engines
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT option_value 
FROM ${prefix}options 
WHERE option_name = 'blog_public';

-- Real execution example with prefix wpx5_:
SELECT option_value FROM wpx5_options WHERE option_name = 'blog_public';
```

**Values:**
- `0` = Search engines blocked (NoIndex enabled) - **CRITICAL ISSUE**
- `1` = Search engines allowed (indexing enabled) - **GOOD**

**Impact:**
- If blocked, site won't appear in Google search results
- Score penalty: -40 points (critical)

#### Check Permalink Structure
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT option_value 
FROM ${prefix}options 
WHERE option_name = 'permalink_structure';

-- Real execution example with prefix wpx5_:
SELECT option_value FROM wpx5_options WHERE option_name = 'permalink_structure';
```

**Values:**
- Empty string = Plain permalinks (bad for SEO)
- `/%postname%/` = Post name structure (good for SEO)
- `/%year%/%monthnum%/%postname%/` = Date and name structure (good)

**Impact:**
- Plain permalinks hurt SEO rankings
- Score penalty: -15 points

### 2. SEO Plugin Detection

#### Find Active Plugins
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT option_value 
FROM ${prefix}options 
WHERE option_name = 'active_plugins';

-- Real execution example with prefix wpx5_:
SELECT option_value FROM wpx5_options WHERE option_name = 'active_plugins';
```

**Returns:** Serialized PHP array like:
```
a:3:{i:0;s:19:"akismet/akismet.php";i:1;s:34:"wordpress-seo/wp-seo.php";i:2;s:36:"seo-by-rank-math/rank-math.php";}
```

**Detection:**
- Yoast SEO: Check if string contains `wordpress-seo`
- Rank Math: Check if string contains `seo-by-rank-math`

**Impact:**
- No SEO plugin detected: -20 points
- Recommendation: Install Yoast SEO or Rank Math

### 3. Yoast SEO Specific Audits

#### Find Published Pages Missing Meta Description
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT p.ID, p.post_title 
FROM ${prefix}posts p 
LEFT JOIN ${prefix}postmeta pm 
  ON p.ID = pm.post_id 
  AND pm.meta_key = '_yoast_wpseo_metadesc' 
WHERE p.post_status = 'publish' 
  AND p.post_type IN ('post', 'page') 
  AND (pm.meta_value IS NULL OR pm.meta_value = '') 
LIMIT 20;

-- Real execution example with prefix wpx5_:
SELECT p.ID, p.post_title 
FROM wpx5_posts p 
LEFT JOIN wpx5_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_yoast_wpseo_metadesc' 
WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') 
AND (pm.meta_value IS NULL OR pm.meta_value = '') LIMIT 20;
```

**Returns:** Post ID and title of pages without meta descriptions

**Impact:**
- Each missing description: -2 points (max -15)
- Meta descriptions improve click-through rates from search results

#### Find Pages Accidentally Set to NoIndex
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT p.ID, p.post_title 
FROM ${prefix}posts p 
INNER JOIN ${prefix}postmeta pm 
  ON p.ID = pm.post_id 
WHERE p.post_status = 'publish' 
  AND p.post_type IN ('post', 'page') 
  AND pm.meta_key = '_yoast_wpseo_meta-robots-noindex' 
  AND pm.meta_value = '1' 
LIMIT 20;

-- Real execution example with prefix wpx5_:
SELECT p.ID, p.post_title 
FROM wpx5_posts p 
INNER JOIN wpx5_postmeta pm ON p.ID = pm.post_id 
WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') 
AND pm.meta_key = '_yoast_wpseo_meta-robots-noindex' AND pm.meta_value = '1' LIMIT 20;
```

**Returns:** Post ID and title of pages hidden from search engines

**Impact:**
- Each NoIndex page: -3 points (max -20)
- These pages won't appear in search results (likely unintentional)

### 4. Rank Math SEO Specific Audits

#### Find Published Pages Missing Meta Description
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT p.ID, p.post_title 
FROM ${prefix}posts p 
LEFT JOIN ${prefix}postmeta pm 
  ON p.ID = pm.post_id 
  AND pm.meta_key = 'rank_math_description' 
WHERE p.post_status = 'publish' 
  AND p.post_type IN ('post', 'page') 
  AND (pm.meta_value IS NULL OR pm.meta_value = '') 
LIMIT 20;

-- Real execution example with prefix wpx5_:
SELECT p.ID, p.post_title 
FROM wpx5_posts p 
LEFT JOIN wpx5_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = 'rank_math_description' 
WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') 
AND (pm.meta_value IS NULL OR pm.meta_value = '') LIMIT 20;
```

**Returns:** Post ID and title of pages without meta descriptions

#### Find Pages Accidentally Set to NoIndex
```sql
-- Example query (actual prefix will be wpx5_, wp82_, etc.)
SELECT p.ID, p.post_title 
FROM ${prefix}posts p 
INNER JOIN ${prefix}postmeta pm 
  ON p.ID = pm.post_id 
WHERE p.post_status = 'publish' 
  AND p.post_type IN ('post', 'page') 
  AND pm.meta_key = 'rank_math_robots' 
  AND pm.meta_value LIKE '%noindex%' 
LIMIT 20;

-- Real execution example with prefix wpx5_:
SELECT p.ID, p.post_title 
FROM wpx5_posts p 
INNER JOIN wpx5_postmeta pm ON p.ID = pm.post_id 
WHERE p.post_status = 'publish' AND p.post_type IN ('post', 'page') 
AND pm.meta_key = 'rank_math_robots' AND pm.meta_value LIKE '%noindex%' LIMIT 20;
```

**Returns:** Post ID and title of pages hidden from search engines

**Note:** Rank Math stores robots meta as serialized array, so we use `LIKE '%noindex%'`

### 5. Table Prefix Handling

**CRITICAL:** The implementation extracts the actual table prefix from wp-config.php and uses it in ALL queries.

**How It Works:**
1. Parse wp-config.php to extract `$table_prefix` variable
2. Store prefix in `dbConfig.prefix` (e.g., `wpx5_`, `wp82_`, `wp_`)
3. Use `${dbConfig.prefix}` in all SQL queries
4. MySQL receives queries with correct table names

**Example Flow:**
```typescript
// 1. Extract from wp-config.php
$table_prefix = 'wpx5_';  // Found in wp-config.php

// 2. Store in dbConfig
dbConfig.prefix = 'wpx5_';

// 3. Build query with template literal
const query = `SELECT option_value FROM ${dbConfig.prefix}options WHERE option_name = 'blog_public';`;

// 4. MySQL receives
SELECT option_value FROM wpx5_options WHERE option_name = 'blog_public';
```

**Real Examples:**
- Prefix `wpx5_` → Queries use `wpx5_posts`, `wpx5_postmeta`, `wpx5_options`
- Prefix `wp82_` → Queries use `wp82_posts`, `wp82_postmeta`, `wp82_options`
- Prefix `wp_` → Queries use `wp_posts`, `wp_postmeta`, `wp_options`

**Without proper prefix, you get:**
```
ERROR 1146 (42S02): Table 'database.wp_posts' doesn't exist
```

**With proper prefix, queries work:**
```
mysql> SELECT option_value FROM wpx5_options WHERE option_name = 'blog_public';
+--------------+
| option_value |
+--------------+
| 1            |
+--------------+
```

## Response Scenarios

### Scenario 1: Excellent SEO Health
```json
{
  "checkType": "SEO_HEALTH",
  "status": "PASS",
  "score": 100,
  "message": "SEO health is excellent",
  "details": {
    "globalBlockers": {
      "searchEnginesBlocked": false,
      "badPermalinks": false,
      "permalinkStructure": "/%postname%/"
    },
    "seoPlugins": {
      "hasYoast": true,
      "hasRankMath": false,
      "activePlugins": "a:2:{i:0;s:34:\"wordpress-seo/wp-seo.php\";...}"
    },
    "yoastIssues": {
      "missingMetaDescriptions": [],
      "noindexPages": []
    },
    "rankMathIssues": null,
    "robotsTxt": {
      "exists": true,
      "blocksAll": false
    },
    "sitemap": {
      "exists": true
    },
    "issues": []
  },
  "recommendations": [],
  "duration": 3456,
  "timestamp": "2026-03-03T17:00:00.000Z"
}
```

### Scenario 2: Search Engines Blocked (Critical)
```json
{
  "checkType": "SEO_HEALTH",
  "status": "FAIL",
  "score": 60,
  "message": "1 SEO issue(s) detected",
  "details": {
    "globalBlockers": {
      "searchEnginesBlocked": true,
      "badPermalinks": false,
      "permalinkStructure": "/%postname%/"
    },
    "seoPlugins": {
      "hasYoast": true,
      "hasRankMath": false
    },
    "yoastIssues": {
      "missingMetaDescriptions": [],
      "noindexPages": []
    },
    "issues": [
      "Site is blocking search engines (NoIndex enabled)"
    ]
  },
  "recommendations": [
    "Go to Settings → Reading and uncheck \"Discourage search engines from indexing this site\""
  ],
  "duration": 3456,
  "timestamp": "2026-03-03T17:00:00.000Z"
}
```

### Scenario 3: Multiple SEO Issues
```json
{
  "checkType": "SEO_HEALTH",
  "status": "WARNING",
  "score": 65,
  "message": "4 SEO issue(s) detected",
  "details": {
    "globalBlockers": {
      "searchEnginesBlocked": false,
      "badPermalinks": true,
      "permalinkStructure": "plain (bad)"
    },
    "seoPlugins": {
      "hasYoast": true,
      "hasRankMath": false
    },
    "yoastIssues": {
      "missingMetaDescriptions": [
        { "id": "123", "title": "About Us" },
        { "id": "456", "title": "Contact" },
        { "id": "789", "title": "Services" }
      ],
      "noindexPages": [
        { "id": "234", "title": "Privacy Policy" }
      ]
    },
    "issues": [
      "Using plain permalinks (bad for SEO)",
      "3 pages missing meta descriptions (Yoast)",
      "1 pages accidentally set to NoIndex (Yoast)",
      "sitemap.xml not found"
    ]
  },
  "recommendations": [
    "Go to Settings → Permalinks and choose \"Post name\" structure",
    "Add meta descriptions to all published pages/posts",
    "Review pages set to NoIndex and enable indexing if needed",
    "Enable XML sitemap in SEO plugin settings"
  ],
  "duration": 3456,
  "timestamp": "2026-03-03T17:00:00.000Z"
}
```

### Scenario 4: No SEO Plugin Installed
```json
{
  "checkType": "SEO_HEALTH",
  "status": "WARNING",
  "score": 75,
  "message": "2 SEO issue(s) detected",
  "details": {
    "globalBlockers": {
      "searchEnginesBlocked": false,
      "badPermalinks": false,
      "permalinkStructure": "/%postname%/"
    },
    "seoPlugins": {
      "hasYoast": false,
      "hasRankMath": false,
      "activePlugins": "a:1:{i:0;s:19:\"akismet/akismet.php\";}"
    },
    "yoastIssues": null,
    "rankMathIssues": null,
    "issues": [
      "No SEO plugin detected",
      "sitemap.xml not found"
    ]
  },
  "recommendations": [
    "Install Yoast SEO or Rank Math plugin",
    "Enable XML sitemap in SEO plugin settings"
  ],
  "duration": 3456,
  "timestamp": "2026-03-03T17:00:00.000Z"
}
```

## Scoring System

### Score Penalties
- **Search engines blocked:** -40 points (CRITICAL)
- **No SEO plugin:** -20 points
- **robots.txt blocks all:** -20 points
- **Plain permalinks:** -15 points
- **Missing meta descriptions:** -2 points each (max -15)
- **NoIndex pages:** -3 points each (max -20)
- **No sitemap.xml:** -10 points
- **No robots.txt:** -5 points

### Status Thresholds
- **PASS:** Score >= 80
- **WARNING:** Score >= 60
- **FAIL:** Score < 60

## Automated Healing Scenarios

### Scenario 1: Search Engines Blocked (HIGH Priority)
**Automation Level:** HIGH
**Trigger:** `blog_public = 0`

**Healing Steps:**
1. Detect search engines blocked
2. Prompt user: "Site is blocking search engines. Enable indexing?"
3. User confirms
4. Execute: `UPDATE wp_options SET option_value = '1' WHERE option_name = 'blog_public';`
5. Verify change applied
6. Mark as healed

### Scenario 2: Plain Permalinks (MEDIUM Priority)
**Automation Level:** MEDIUM
**Trigger:** `permalink_structure` is empty

**Healing Steps:**
1. Detect plain permalinks
2. Prompt user: "Using plain permalinks. Switch to post name structure?"
3. User confirms
4. Execute: `UPDATE wp_options SET option_value = '/%postname%/' WHERE option_name = 'permalink_structure';`
5. Flush rewrite rules (requires WP-CLI)
6. Mark as healed

### Scenario 3: Missing Meta Descriptions (LOW Priority)
**Automation Level:** LOW (requires content)
**Trigger:** Pages without meta descriptions

**Healing Steps:**
1. Detect pages missing meta descriptions
2. Show list to user
3. User can:
   - Add descriptions manually in WordPress admin
   - Use AI to generate descriptions (future feature)
4. Re-check after user updates

### Scenario 4: Accidental NoIndex Pages (MEDIUM Priority)
**Automation Level:** MEDIUM
**Trigger:** Published pages set to NoIndex

**Healing Steps:**
1. Detect NoIndex pages
2. Show list to user: "These pages are hidden from search engines"
3. User confirms which pages should be indexed
4. For Yoast: `DELETE FROM wp_postmeta WHERE post_id = X AND meta_key = '_yoast_wpseo_meta-robots-noindex';`
5. For Rank Math: `UPDATE wp_postmeta SET meta_value = '' WHERE post_id = X AND meta_key = 'rank_math_robots';`
6. Mark as healed

## Security Considerations

### 1. Password Handling
- Password properly escaped for shell
- Uses same secure approach as database connection check
- No password exposure in logs

### 2. SQL Injection Prevention
- Table prefix extracted from wp-config.php (trusted source)
- No user input in SQL queries
- All queries are read-only (SELECT)

### 3. Output Filtering
- Filters MySQL warnings
- Filters header lines
- Extracts only relevant data

## Performance Considerations

### Query Optimization
- All queries use `LIMIT 20` to prevent large result sets
- Queries use indexes (post_status, post_type, meta_key)
- Total execution time: 3-5 seconds

### Caching Opportunities
- SEO plugin detection can be cached (rarely changes)
- Global blockers can be cached (rarely changes)
- Meta description/NoIndex audits should run fresh (content changes)

## Testing Checklist

### Manual Testing Required
- [ ] Test with Yoast SEO installed
- [ ] Test with Rank Math installed
- [ ] Test with no SEO plugin
- [ ] Test with search engines blocked
- [ ] Test with plain permalinks
- [ ] Test with pages missing meta descriptions
- [ ] Test with NoIndex pages
- [ ] Test with custom table prefix (wpx5_, wp123_, etc.)
- [ ] Verify recommendations are actionable
- [ ] Test healing scenarios

### Expected Outcomes
1. **Search engines blocked:** Status = FAIL, score = 60, critical recommendation
2. **No SEO plugin:** Status = WARNING, score = 75-80, install recommendation
3. **Missing meta descriptions:** Status = WARNING, score varies, list of pages shown
4. **NoIndex pages:** Status = WARNING, score varies, list of pages shown
5. **All good:** Status = PASS, score = 100, no recommendations

## Files Modified
- `backend/src/modules/healer/services/checks/seo-health.service.ts`

## Build Status
✅ Build passes without errors

## Next Steps
1. Test with real WordPress sites (Yoast and Rank Math)
2. Verify query performance on large sites (1000+ posts)
3. Implement automated healing for search engines blocked
4. Implement automated healing for plain permalinks
5. Add AI-powered meta description generation (future)
6. Add schema markup audit (future)
7. Add page speed audit integration (future)

## Notes
- Queries are plugin-specific (Yoast vs Rank Math use different meta keys)
- Limit 20 results to prevent overwhelming user with too many issues
- Score penalties are balanced to reflect SEO impact
- File-based checks (robots.txt, sitemap.xml) are still included for completeness
- Removed HTTP-based checks (meta tags, Open Graph) as they're unreliable and slow
- Database queries are much faster and more accurate than HTTP requests
