# Meta-Engineering Memory System

Cross-session learning database for the pushup-stats-service project.

## Overview

This directory contains extracted learnings from development sessions. It enables Claude to:

1. **Recognize patterns** - Identify and prevent recurring issues
2. **Apply improvements** - Use tested solutions from previous sessions
3. **Avoid mistakes** - Reference documented pitfalls and solutions
4. **Understand architecture** - Access reusable architectural patterns
5. **Make better decisions** - Build on technical insights and process improvements

## Files

### Core Files

#### `patterns.json`

Pattern registry with severity levels, tool dependencies, and recurring solutions.

**Use this when:**

- Encountering a test setup error → Check "angular-test-api-mismatch"
- Running replace_all operations → Check "edit-tool-replace-collisions"
- Building SSR apps → Check "ssr-hydration-store-state"
- Working on multi-language features → Check "blog-hreflang-multilang-issue"

**Structure:**

```json
{
  "patterns": [
    {
      "id": "pattern-id",
      "name": "Pattern Name",
      "category": "test-maintenance",
      "severity": "high|medium|low",
      "description": "What the pattern is",
      "fix_pattern": "How to fix it",
      "prevention": "How to prevent it"
    }
  ],
  "tool_dependencies": {
    "Tool1+Tool2": {
      "tools": ["Tool1", "Tool2"],
      "co_usage_count": 5,
      "description": "Why these tools are used together"
    }
  },
  "recurring_issues": [...]
}
```

#### `evolution.json`

Skill improvements, architectural patterns, and technical insights.

**Use this when:**

- Adding a new feature to app root → Reference "app-shell-testing"
- Working with SSR hydration → Reference "ssr-patterns"
- Generating sitemaps for multi-language sites → Reference "sitemap-multilingual"
- Using string replacements in large refactors → Reference "edit-tool-safety"

**Structure:**

```json
{
  "template_improvements": [
    {
      "skill": "skill-name",
      "section": "Section Name",
      "change": "What was added",
      "reasoning": "Why it helps",
      "confidence": 0.95
    }
  ],
  "architectural_patterns_documented": [
    {
      "name": "Pattern Name",
      "description": "How to use it",
      "when_to_use": "Specific scenarios",
      "success_example": "Real example from code"
    }
  ],
  "technical_insights_recorded": [
    {
      "topic": "Topic Name",
      "insight": "Key learning",
      "applicability": "Where this applies",
      "source": "Where it came from"
    }
  ]
}
```

#### `learning-log.jsonl`

Append-only session log for tracking learning over time.

**Format:** One JSON object per line (JSONL)

```jsonl
{
  "timestamp": "2026-04-05T00:00:00Z",
  "session": "AdSense approval fix (PR #176)",
  "patterns": 7,
  "skills_adjusted": 5,
  "confidence_avg": 0.91
}
```

#### `session-learning-2026-04-05.json`

Complete analysis of the AdSense approval session with evidence verification.

## How to Use

### Finding Information

**When you encounter an issue:**

1. **Check patterns.json** for matching patterns
   - Look for severity, category, fix_pattern
   - Read prevention guidance

2. **Check evolution.json** for related skills
   - Find updated skill sections
   - Reference concrete examples
   - Consult architectural patterns

3. **Check learning-log.jsonl** for session history
   - Understand frequency of issues
   - Track confidence metrics over time

### Documenting New Learning

After resolving an issue:

1. **Update patterns.json** if new pattern discovered
2. **Add to evolution.json** if skill needs updating
3. **Append to learning-log.jsonl** when session complete

## Key Patterns (Quick Reference)

### HIGH SEVERITY

#### App Shell Store Injection Ripple Effect

- **Issue:** Store injected to app root → all tests fail
- **Fix:** Add store mock to TestBed
- **Prevention:** Consider lazy-loading stores

#### SSR Hydration: Browser State Divergence

- **Issue:** Server state differs from client (no localStorage on server)
- **Fix:** Use `withHooks onInit` to sync after hydration
- **Prevention:** Document browser-only signals

### MEDIUM SEVERITY

#### Edit Tool Replace String Collisions

- **Issue:** `replace_all` with short strings matches wrong locations
- **Fix:** Use specific search patterns with context
- **Prevention:** Test on small file first; review diffs

#### Angular Testing Framework Mismatch

- **Issue:** Jest vs Vitest have different APIs
- **Fix:** Check project.json; use framework-specific APIs
- **Prevention:** Maintain separate patterns per framework

### LOW SEVERITY

#### Blog hreflang with Different Language Slugs

- **Issue:** hreflang points to non-existent routes when slugs differ
- **Fix:** Disable hreflang for blog routes
- **Prevention:** Only use hreflang for parallel-structure routes

#### Static File Serving: URL Rewrite vs sendFile

- **Issue:** sendFile has security concerns for i18n files
- **Fix:** Use Express rewrite middleware
- **Prevention:** For i18n files, prefer rewrite + express.static

## Confidence Levels

- **95%** - Proven solution from multiple sessions
- **90%** - Strong evidence from implementation
- **85%** - Good evidence but specific to context
- **80%** - Solid evidence but may need adaptation

## Statistics

- **Patterns:** 7 documented
- **Skills Updated:** 5
- **Architectural Patterns:** 3
- **Technical Insights:** 4
- **Average Confidence:** 91%
- **Total Memory:** 28 KB

## Last Updated

2026-04-05 (AdSense approval fix session)

## Navigation

- **For testing issues:** See patterns.json → angular-test-api-mismatch or app-shell-store-injection
- **For SSR issues:** See evolution.json → ssr-patterns
- **For string replacement:** See evolution.json → edit-tool-safety
- **For multi-language:** See evolution.json → sitemap-multilingual
- **For full details:** See session-learning-2026-04-05.json

## Implementation Notes

All learnings in this memory system are:

- ✓ Evidence-based (from actual PR #176 implementation)
- ✓ Actionable (concrete fix patterns)
- ✓ Preventive (prevention strategies included)
- ✓ Cross-session (cumulative learning)
- ✓ Confidence-scored (reliability metrics)

NO assumptions, guesses, or model-generated patterns.
