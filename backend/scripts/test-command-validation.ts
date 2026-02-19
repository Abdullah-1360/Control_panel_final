/**
 * Test script to verify command validation improvements
 */

// Simulate the validation logic
function validateCommand(command: string): { valid: boolean; reason?: string } {
  // Check for null bytes
  if (command.includes('\0')) {
    return { valid: false, reason: 'Null byte detected in command' };
  }

  // Allow multi-line commands
  if (command.includes('\n')) {
    return { valid: true };
  }

  // Allow bash for loops
  if (/^for\s+\w+\s+in\s+.*;\s*do\s+.*;\s*done$/.test(command.trim())) {
    return { valid: true };
  }

  // Check for dangerous command chaining
  const safeCdPattern = /^cd\s+[^\s;&|]+\s+&&\s+/;
  const safeTestPattern = /^(test\s+|\[\s+).*&&\s+(echo|true|return)/;
  const safeVarPattern = /^\w+=\$\([^)]+\)\s+&&\s+/;
  const hasUnsafeAnd = /&&/.test(command) && 
                       !safeCdPattern.test(command) && 
                       !safeTestPattern.test(command) &&
                       !safeVarPattern.test(command);
  
  const safeFallbackPattern = /\|\|\s*(true|echo|return)/;
  const sameCommandFallback = /^(\w+(?:\s+-[a-zA-Z0-9]+)*)\s+[^\s;&|]+\s+\|\|\s+\1\s+/;
  const hasUnsafeOr = /\|\|/.test(command) && 
                      !safeFallbackPattern.test(command) && 
                      !sameCommandFallback.test(command);
  
  const hasDangerousSemicolon = /;/.test(command) && !/^for\s+\w+\s+in\s+.*;\s*do\s+.*;\s*done$/.test(command.trim());
  
  if (hasUnsafeAnd || hasUnsafeOr || hasDangerousSemicolon) {
    return { valid: false, reason: 'Dangerous command chaining detected' };
  }

  // Allow command substitution in safe contexts
  if (/`/.test(command)) {
    return { valid: false, reason: 'Backtick command substitution detected' };
  }
  
  if (/\$\(/.test(command)) {
    const isInVarAssignment = /^\w+=\$\([^)]+\)/.test(command.trim());
    const isInForLoop = /^for\s+\w+\s+in\s+.*\$\(/.test(command.trim());
    const isInSafeContext = /\w+=\$\([^)]+\)/.test(command);
    
    if (!isInVarAssignment && !isInForLoop && !isInSafeContext) {
      return { valid: false, reason: 'Unsafe command substitution detected' };
    }
  }

  return { valid: true };
}

// Test cases
const testCases = [
  // Should PASS
  {
    name: 'Bash for loop with command substitution',
    command: 'for item in domain1:user1 domain2:user2; do domain=${item%%:*}; user=${item##*:}; docroot=$(grep -E "^documentroot:" /var/cpanel/userdata/$user/$domain 2>/dev/null | cut -d: -f2- | xargs); [ -n "$docroot" ] && echo "$domain|$docroot"; done',
    shouldPass: true,
  },
  {
    name: 'Variable assignment with command substitution',
    command: 'docroot=$(grep -E "^documentroot:" /var/cpanel/userdata/user/domain 2>/dev/null | cut -d: -f2- | xargs)',
    shouldPass: true,
  },
  {
    name: 'cd with command',
    command: 'cd /home/user/public_html && tail -100 wp-content/debug.log',
    shouldPass: true,
  },
  {
    name: 'Safe OR fallback',
    command: 'tail -100 /var/log/apache2/error.log || tail -100 /var/log/httpd/error_log',
    shouldPass: true,
  },
  {
    name: 'Test with echo',
    command: 'test -f file && echo "exists"',
    shouldPass: true,
  },
  {
    name: 'Simple command',
    command: 'ls -la',
    shouldPass: true,
  },
  {
    name: 'Grep with pipe',
    command: 'grep -i "error" wp-content/debug.log | tail -20',
    shouldPass: true,
  },
  
  // Should FAIL
  {
    name: 'Dangerous command chaining',
    command: 'rm file && rm -rf /',
    shouldPass: false,
  },
  {
    name: 'Backtick command substitution',
    command: 'echo `whoami`',
    shouldPass: false,
  },
  {
    name: 'Unsafe command substitution (direct execution)',
    command: '$(malicious_command)',
    shouldPass: false,
  },
  {
    name: 'Semicolon separator (not in for loop)',
    command: 'ls -la; rm file',
    shouldPass: false,
  },
  {
    name: 'Null byte injection',
    command: 'ls\0rm -rf /',
    shouldPass: false,
  },
];

console.log('🧪 Testing Command Validation\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = validateCommand(test.command);
  const success = result.valid === test.shouldPass;
  
  if (success) {
    passed++;
    console.log(`✅ PASS: ${test.name}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Expected: ${test.shouldPass ? 'VALID' : 'INVALID'}`);
    console.log(`   Got: ${result.valid ? 'VALID' : 'INVALID'}`);
    if (result.reason) {
      console.log(`   Reason: ${result.reason}`);
    }
    console.log(`   Command: ${test.command.substring(0, 100)}${test.command.length > 100 ? '...' : ''}`);
  }
  console.log('');
}

console.log('=' .repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('✨ All tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed!');
  process.exit(1);
}
