---
inclusion: always
---

# Question-First Approach - MANDATORY Clarification Guidelines

## Core Principle

**NEVER ASSUME. ALWAYS ASK.**

When faced with ambiguity, incomplete information, or multiple valid interpretations, you MUST ask clarifying questions before proceeding.

## 🔴 MANDATORY: When Questions Are REQUIRED

### 1. Ambiguous Requirements
**ASK when:** User request lacks specific details, multiple solutions exist, scope is unclear

**Example:**
- ❌ BAD: "add authentication" → Implement without asking
- ✅ GOOD: Ask about MFA, sessions, token storage, following Module 1 plan

### 2. Technology Choices
**ASK when:** Multiple libraries solve same problem, version matters, config has trade-offs

### 3. Design Decisions
**ASK when:** Schema has multiple approaches, API structure unclear, state management not specified

### 4. Scope Clarification
**ASK when:** Could mean backend-only or full-stack, testing not specified, docs unclear

**Example:**
- ❌ BAD: "implement Module 2" → Build entire module
- ✅ GOOD: Ask about sprint scope, backend vs full-stack, tests, memory updates

### 5. Existing Code Modifications
**ASK when:** Changes could break functionality, multiple files need updates, backward compatibility matters

### 6. Performance vs. Simplicity
**ASK when:** Optimization adds complexity, caching not specified, real-time needs unclear

### 7. Security Considerations
**ASK when:** Security implications significant, encryption not specified, access control unclear

### 8. Testing Strategy
**ASK when:** Coverage not stated, approach unclear, mock strategy not specified

## 🚨 Red Flags - STOP and ASK

1. "I'm not sure if..." → ASK
2. "This could be done multiple ways..." → ASK
3. "The user didn't specify..." → ASK
4. "I'll assume..." → ASK instead
5. "This might break..." → ASK
6. "I could either..." → ASK which option
7. "The plan doesn't mention..." → ASK
8. "This conflicts with..." → ASK how to resolve

## ✅ Good Question Characteristics

1. **Specific:** Concrete choices, not vague
   - ❌ "How should I implement this?"
   - ✅ "Should I use JWT with RS256 or HS256?"

2. **Actionable:** Clear options to choose
   - ✅ "Should I implement MFA now, or later?"

3. **Contextual:** Reference constraints/standards
   - ✅ "Tech stack specifies Redis. Add caching or keep simple?"

4. **Prioritized:** Critical questions first (scope → details → optimizations)

5. **Grouped:** Combine related questions (max 3-5 per message)

## 📋 Question Templates

**Requirements:** "Should I implement [X] or [Y]?"
**Scope:** "Full [module] or start with [subset]?"
**Technology:** "Use [library A] or [library B]?"
**Design:** "One-to-many or many-to-many relationship?"
**Security:** "Encrypt with [method]? Add audit logging?"
**Performance:** "Add pagination? Real-time updates?"
**Testing:** "Unit tests, integration tests, or both?"

## 🎯 Decision Tree

```
Request Received → 100% clear?
  YES → Proceed
  NO → In plan docs?
    YES → Follow plan, confirm if needed
    NO → STOP and ASK
```

## 🚫 Anti-Patterns

DON'T:
1. Ask questions answerable from plan docs
2. Ask vague questions without context
3. Ask too many at once (max 3-5)
4. Ask after implementation
5. Ask rhetorical questions
6. Ask permission for best practices

Bad Examples:
- ❌ "Should I write good code?"
- ❌ "What do you want?"
- ❌ "I implemented X, okay?"
- ❌ "Should I follow tech stack?"

## 🔧 Enforcement

**MANDATORY** - Takes precedence over speed. Better to ask than refactor later.

## 🎓 Iterative Clarification

When unclear:
1. Acknowledge response
2. Ask follow-up: "Just to confirm..."
3. Summarize understanding
4. Proceed only when 100% clear

---
**Status:** ACTIVE - MANDATORY COMPLIANCE
