# Database Connection Proper Testing Implementation

## Status: ✅ COMPLETE (Enhanced with WordPress Integrity Verification)

## Overview
Implemented proper database connection testing that:
1. Parses wp-config.php to extract credentials and table prefix
2. Tests actual connection with error categorization by MySQL error codes
3. Verifies WordPress integrity by checking for core 12 required tables
4. Identifies database bloat that could cause performance issues

## Implementation Details

### 1. Parse wp-config.php
- Extracts `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` from wp-config.php
- Extracts `$table_prefix` variable (e.g., 'wpx5_', 'wp_', 'wp123_')
- Supports multiple define() syntax patterns (single quotes, double quotes)
- Defaults to 'localhost' if DB_HOST not found
- Defaults to 'wp_' if table prefix not found
- Validates required credentials are present

### 2. Test Actual Connection
- Creates temporary MySQL config file with credentials
- Uses `--defaults-file` to avoid exposing password in process list
- Tests connection with `USE database; SELECT 1;`
- Cleans up config file after test (even on error)

### 3. Verify WordPress Integrity (Core 12 Tables Check)
WordPress requires 12 base tables to function:
1. `posts` - All post types
2. `postmeta` - Post metadata
3. `options` - Site settings
4. `users` - User accounts
5. `usermeta` - User metadata
6. `terms` - Categories, tags
7. `term_taxonomy` - Taxonomy definitions
8. `term_relationships` - Post-term relationships
9. `termmeta` - Term metadata
10. `comments` - Comments
11. `commentmeta` - Comment metadata
12. `links` - Blogroll links

**Check Process:**
- Runs `SHOW TABLES LIKE 'prefix_%'` query
- Cross-references output against hardcoded array of required tables
- Identifies which tables are present and which are missing
- Reports integrity status

### 4. Identify Database Bloat
Analyzes table sizes to identify performance bottlenecks:

**Bloat Thresholds:**
- `wp_options` table > 50 MB = bloated
- Log tables (any table with 'log' in name) > 100 MB = bloated
- Other tables > 500 MB = bloated

**Common Bloat Sources:**
- `wp_loginizer_logs` - Login attempt logs (can reach 5+ GB)
- `wp_wfLogs` - Wordfence security logs
- `wp_options` - Transients, autoloaded options
- `wp_actionscheduler_logs` - WooCommerce action logs

### 5. Error Categorization

#### Error 2002 - CONNECTION_REFUSED
**Cause:** MySQL server is down or DB_HOST is wrong
**Detection:** `ERROR 2002`, `Connection refused`, `Can't connect`
**Recommendations:**
- Check if MySQL/MariaDB service is running
- Verify DB_HOST is correct
- Try "127.0.0.1" instead of "localhost" or vice versa
- Check firewall rules if using remote database

#### Error 1045 - ACCESS_DENIED (AUTOMATABLE)
**Cause:** Credentials in wp-config.php are incorrect
**Detection:** `ERROR 1045`, `Access denied`
**Recommendations:**
- **AUTOMATABLE: Database password mismatch detected**
- Verify DB_USER has correct password
- Check if password was changed in cPanel but not in wp-config.php
- Update wp-config.php with correct credentials

**Healing Scenario:** This is highly automatable - the healer can:
1. Detect password mismatch
2. Prompt user for correct password
3. Update wp-config.php automatically
4. Verify connection works

#### Error 1049 - UNKNOWN_DATABASE
**Cause:** Database has been deleted
**Detection:** `ERROR 1049`, `Unknown database`
**Recommendations:**
- Database has been deleted
- Restore database from backup
- Or create new database and import backup
- Verify database name in wp-config.php is correct

#### MYSQL_NOT_FOUND
**Cause:** MySQL client not installed on server
**Detection:** `mysql: command not found`, `mysql: not found`
**Recommendations:**
- Install MySQL client: `apt-get install mysql-client` or `yum install mysql`
- Verify MySQL/MariaDB is installed

#### OTHER
**Cause:** Unknown error
**Detection:** Any other error
**Recommendations:**
- Check wp-config.php database credentials
- Verify MySQL/MariaDB service is running
- Check database server connectivity
- Verify database user permissions

## Security Features

### 1. No Password Exposure
- Password never appears in process list
- Uses temporary MySQL config file with `--defaults-file`
- Config file has 600 permissions (owner read/write only)

### 2. Secure Cleanup
- Config file deleted after test
- Cleanup happens even if test fails (try-finally)
- Random filename to avoid conflicts

### 3. Password Escaping
- Special characters in password are properly escaped
- Prevents command injection

## Response Format

### Success Response
```json
{
  "checkType": "DATABASE_CONNECTION",
  "status": "PASS",
  "score": 100,
  "message": "Database connection successful",
  "details": {
    "connected": true,
    "dbHost": "localhost",
    "dbName": "wp_database",
    "dbUser": "wp_user",
    "errorType": null,
    "errorCode": null,
    "errorMessage": null,
    "rawOutput": "1\n1"
  },
  "recommendations": [],
  "duration": 1234,
  "timestamp": "2026-03-03T15:30:00.000Z"
}
```

### Error 1045 Response (Automatable)
```json
{
  "checkType": "DATABASE_CONNECTION",
  "status": "FAIL",
  "score": 0,
  "message": "Database credentials are incorrect (Error 1045)",
  "details": {
    "connected": false,
    "dbHost": "localhost",
    "dbName": "wp_database",
    "dbUser": "wp_user",
    "errorType": "ACCESS_DENIED",
    "errorCode": "1045",
    "errorMessage": "Database credentials are incorrect",
    "rawOutput": "ERROR 1045 (28000): Access denied for user 'wp_user'@'localhost' (using password: YES)"
  },
  "recommendations": [
    "AUTOMATABLE: Database password mismatch detected",
    "Verify DB_USER (wp_user) has correct password",
    "Check if password was changed in cPanel but not in wp-config.php",
    "Update wp-config.php with correct credentials"
  ],
  "duration": 1234,
  "timestamp": "2026-03-03T15:30:00.000Z"
}
```

### Error 2002 Response
```json
{
  "checkType": "DATABASE_CONNECTION",
  "status": "FAIL",
  "score": 0,
  "message": "MySQL server is down or unreachable (Error 2002)",
  "details": {
    "connected": false,
    "dbHost": "localhost",
    "dbName": "wp_database",
    "dbUser": "wp_user",
    "errorType": "CONNECTION_REFUSED",
    "errorCode": "2002",
    "errorMessage": "MySQL server is down or DB_HOST is incorrect",
    "rawOutput": "ERROR 2002 (HY000): Can't connect to local MySQL server through socket '/var/run/mysqld/mysqld.sock' (2)"
  },
  "recommendations": [
    "Check if MySQL/MariaDB service is running",
    "Verify DB_HOST is correct: localhost",
    "If using \"localhost\", try \"127.0.0.1\" or vice versa",
    "Check firewall rules if using remote database"
  ],
  "duration": 1234,
  "timestamp": "2026-03-03T15:30:00.000Z"
}
```

### Error 1049 Response
```json
{
  "checkType": "DATABASE_CONNECTION",
  "status": "FAIL",
  "score": 0,
  "message": "Database \"wp_database\" does not exist (Error 1049)",
  "details": {
    "connected": false,
    "dbHost": "localhost",
    "dbName": "wp_database",
    "dbUser": "wp_user",
    "errorType": "UNKNOWN_DATABASE",
    "errorCode": "1049",
    "errorMessage": "Database wp_database does not exist",
    "rawOutput": "ERROR 1049 (42000): Unknown database 'wp_database'"
  },
  "recommendations": [
    "Database wp_database has been deleted",
    "Restore database from backup",
    "Or create new database and import backup",
    "Verify database name in wp-config.php is correct"
  ],
  "duration": 1234,
  "timestamp": "2026-03-03T15:30:00.000Z"
}
```

## Testing Checklist

### Manual Testing Required
- [ ] Test with correct credentials (should PASS)
- [ ] Test with wrong password (should detect Error 1045)
- [ ] Test with wrong DB_HOST (should detect Error 2002)
- [ ] Test with deleted database (should detect Error 1049)
- [ ] Test with MySQL stopped (should detect Error 2002)
- [ ] Verify password not visible in process list during test
- [ ] Verify config file is cleaned up after test
- [ ] Test with special characters in password

### Expected Outcomes
1. **Correct credentials:** Status = PASS, score = 100
2. **Wrong password:** Status = FAIL, errorType = ACCESS_DENIED, errorCode = 1045
3. **MySQL down:** Status = FAIL, errorType = CONNECTION_REFUSED, errorCode = 2002
4. **Database deleted:** Status = FAIL, errorType = UNKNOWN_DATABASE, errorCode = 1049
5. **MySQL not installed:** Status = FAIL, errorType = MYSQL_NOT_FOUND

## Automated Healing Scenarios

### Scenario 1: Password Mismatch (Error 1045)
**Automation Level:** HIGH
**Steps:**
1. Detect Error 1045 (ACCESS_DENIED)
2. Prompt user: "Database password appears incorrect. Enter correct password:"
3. User provides correct password
4. Update wp-config.php with new password
5. Re-test connection
6. If successful, mark as healed

**Implementation:**
```typescript
// In healer service
if (result.details.errorType === 'ACCESS_DENIED') {
  // This is automatable
  const newPassword = await promptUser('Enter correct database password:');
  await updateWpConfigPassword(serverId, sitePath, newPassword);
  const retestResult = await checkDatabaseConnection(serverId, sitePath);
  if (retestResult.status === 'PASS') {
    return { healed: true, message: 'Database password updated successfully' };
  }
}
```

### Scenario 2: Wrong DB_HOST (Error 2002)
**Automation Level:** MEDIUM
**Steps:**
1. Detect Error 2002 with "localhost" as DB_HOST
2. Try alternative: "127.0.0.1"
3. If successful, update wp-config.php
4. Mark as healed

### Scenario 3: Database Deleted (Error 1049)
**Automation Level:** LOW (requires backup)
**Steps:**
1. Detect Error 1049
2. Check for available backups
3. If backup found, prompt user to restore
4. Restore database from backup
5. Re-test connection

## Files Modified
- `backend/src/modules/healer/services/checks/database-connection.service.ts`

## Build Status
✅ Build passes without errors

## Next Steps
1. Test with real WordPress sites
2. Verify error categorization works correctly
3. Implement automated healing for Error 1045 (password mismatch)
4. Add metrics tracking for error types
5. Consider adding retry logic for transient errors

## Notes
- Config file uses random filename to avoid conflicts
- Password escaping handles special characters
- Cleanup happens even if test fails
- Error messages are user-friendly and actionable
- AUTOMATABLE flag in recommendations helps healer identify fixable issues
