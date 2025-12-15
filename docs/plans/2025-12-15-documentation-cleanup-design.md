# Documentation Cleanup & Restructuring Design

**Date:** 2025-12-15
**Status:** Approved
**Target Audience:** Developers with existing BigQuery data who want to sync to Harper

## Problem Statement

The project has documentation debt from rapid v2.0 development. New developers with their own BigQuery data struggle to answer:
- "What does this plugin do RIGHT NOW?"
- "What's the quickest path to sync MY data?"
- "Is this production-ready or still in development?"

The documentation landscape has:
- Historical design docs from feature development (`docs/plans/`)
- Internal analysis documents (`docs/internal/`)
- Research artifacts at root (`GLOBALS_LOGGING_RESEARCH.md`, `LOGGING_ANALYSIS_BY_FILE.md`)
- A roadmap called `TODO.md` that doesn't clearly show "we shipped v2.0"
- A README that mixes completed features with future plans

Maritime example data is fine and should stay as a working reference, but it shouldn't dominate the getting-started experience.

## Solution: Three-Tier Documentation Structure

### 1. User-Facing (Public Docs)
What users need to know RIGHT NOW

**Keep:**
- `README.md` (rewritten)
- `ROADMAP.md` (renamed from TODO.md, rewritten)
- `CHANGELOG.md` (updated with v2.0.0)
- `CONTRIBUTING.md` (minor updates)
- `docs/quickstart.md`
- `docs/system-overview.md`
- `docs/maritime-synthesizer.md`
- `docs/design-document.md`
- `docs/security.md`
- `docs/HISTORY.md`
- `docs/blog-post.md`

### 2. Historical (Gitignored)
Development artifacts, internal analysis, completed design docs

**Gitignore:**
- `docs/plans/` - Design docs from completed features
- `docs/internal/` - Internal analysis and research

### 3. Cleanup (Delete)
Research artifacts that don't belong in version control

**Delete:**
- `GLOBALS_LOGGING_RESEARCH.md`
- `LOGGING_ANALYSIS_BY_FILE.md`

## File Changes

### Deletions
```bash
git rm GLOBALS_LOGGING_RESEARCH.md
git rm LOGGING_ANALYSIS_BY_FILE.md
```

### .gitignore Additions
```
# Historical development artifacts
docs/plans/
docs/internal/
```

### Renames
```bash
git mv TODO.md ROADMAP.md
```

## Content Updates

### README.md - Complete Rewrite

**New Structure:**
1. **Hero Section**
   - "Production-ready distributed data ingestion from Google BigQuery to Harper"
   - Badges (version, license, Node version)

2. **Features (v2.0)**
   - Multi-table support
   - Column selection
   - Horizontal scalability
   - Adaptive batch sizing
   - Failure recovery
   - Exponential backoff
   - Production-ready with comprehensive logging

3. **Quick Start (YOUR Data)**
   - Install Harper + plugin
   - Configure with REAL data example (not maritime)
   - Run simple command

4. **Architecture**
   - Brief overview: modulo partitioning, checkpointing, Harper clustering

5. **Configuration Reference**
   - Real-world examples FIRST
   - Maritime examples SECOND

6. **Maritime Test Data (Optional)**
   - "Want to test before connecting your data?"
   - Link to maritime-specific docs

7. **Monitoring & Operations**
   - Status endpoints
   - Checkpoint queries
   - Lag monitoring

8. **Troubleshooting**
   - Common issues for REAL data

9. **Roadmap**
   - Link to ROADMAP.md

10. **Contributing**
    - Link to CONTRIBUTING.md

**Key Messaging Shift:**
- OLD: "Here's a sync plugin we're building, and it has a maritime data generator for testing"
- NEW: "Production-ready BigQuery sync plugin. Multi-table, scalable, battle-tested. Maritime example included for testing."

### ROADMAP.md - Rewrite TODO.md

**New Structure:**
1. **Headline:** "🎉 v2.0 Complete - Multi-Table Production Release"

2. **What's Shipped (v2.0)**
   - Multi-table support with independent sync settings
   - Column selection to reduce data transfer costs
   - Per-table configuration (batch sizes, intervals, strategies)
   - Exponential backoff retry logic with jitter
   - Comprehensive logging for Grafana observability
   - Multi-table validation and monitoring
   - Backward compatibility with single-table format

3. **What's Next (v3.0 Vision)**
   - Multi-threaded ingestion per node
   - Dynamic rebalancing for autoscaling
   - Enhanced monitoring dashboards
   - Thread-level checkpointing

4. **Future Considerations**
   - Testing infrastructure improvements
   - Documentation enhancements
   - Developer experience improvements
   - (Without specific commitments)

5. **How to Contribute**
   - Link to CONTRIBUTING.md
   - Link to GitHub issues

**Tone Shift:**
- OLD: "Here's everything we need to do"
- NEW: "Here's what we shipped, here's what we're considering next"

### CHANGELOG.md - Add v2.0.0 Entry

Add at the top:

```markdown
## [2.0.0] - 2025-12-15

### Added
- Multi-table support - Sync multiple BigQuery tables simultaneously
- Column selection - Reduce costs by fetching only needed columns
- Per-table configuration with independent batch sizes and sync strategies
- Exponential backoff retry logic with jitter for transient errors
- Comprehensive logging throughout codebase for Grafana observability
- Optional streaming insert API for BigQuery (configurable)
- Multi-table validation and monitoring
- Maritime data synthesizer "Why Maritime Data?" rationale documentation

### Changed
- Improved error messages and retry handling
- Enhanced BigQuery client with smart retry logic
- Better organization of codebase (src/ vs tools/)

### Fixed
- Memory leak in journey tracking system
- Checkpoint timestamp handling edge cases
- Prettier formatting for markdown documentation

### Documentation
- Added streaming insert API design document
- Enhanced logging analysis and research
- Project history documentation
- Multi-table configuration examples
```

### CONTRIBUTING.md - Minor Updates

**Changes:**
1. Update "Testing" section to reflect current test coverage
2. Remove references to "future test infrastructure" if they're misleading
3. Update "Key Files" section to reflect any architectural changes
4. Verify all paths and file references are current

## Implementation Phases

### Phase 1: Cleanup (Remove Clutter)
1. Delete `GLOBALS_LOGGING_RESEARCH.md`, `LOGGING_ANALYSIS_BY_FILE.md`
2. Add `.gitignore` entries for `docs/plans/` and `docs/internal/`
3. Git rm the gitignored directories

### Phase 2: Restructure (Rename & Organize)
1. Rename `TODO.md` → `ROADMAP.md`

### Phase 3: Rewrite (Update Content)
1. Add v2.0.0 entry to `CHANGELOG.md`
2. Rewrite `ROADMAP.md` with v2.0 completion messaging
3. Complete rewrite of `README.md` following new structure
4. Minor updates to `CONTRIBUTING.md`

### Phase 4: Verify
1. Check all internal doc links still work
2. Ensure maritime quickstart still makes sense
3. Verify config examples are accurate
4. Test that gitignored directories don't interfere with functionality

## Success Criteria

**For New Developers:**
- Land on README → immediately see "production-ready v2.0"
- Find Quick Start with THEIR use case (real data, not maritime)
- Understand what's available now vs. what's planned
- Can ignore maritime content if not relevant

**For Existing Users:**
- No breaking changes to functionality
- Maritime example still works perfectly
- All existing docs still accessible
- Clear migration path shown in CHANGELOG

**For Contributors:**
- Clear current state in ROADMAP.md
- CONTRIBUTING.md reflects actual codebase
- Historical context preserved in HISTORY.md
- Clean, focused documentation structure

## Philosophy

**"Show me what works today, not what you're planning"**

The documentation should reflect the reality of a production-ready v2.0 release, not an in-development project. Maritime is a working example, not the primary use case.
