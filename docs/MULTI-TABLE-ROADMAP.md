# Multi-Table Architecture Roadmap

## Overview

This document outlines the roadmap for extending the BigQuery sync plugin to support multiple tables with per-table column selection. This is Phase 2 of the column selection feature implementation.

## Current State (Phase 1 - Completed)

✅ **Column Selection for Single Table**
- Config supports optional `columns` field
- Defaults to `SELECT *` when not specified
- Validates that timestamp column is included
- QueryBuilder extracts SQL construction logic
- Type conversion utilities extracted to separate module
- Comprehensive test coverage

**Current Limitations:**
- Only one BigQuery table can be synced per plugin instance
- All configuration is at the plugin level
- Single SyncEngine manages one table

## Future State (Phase 2 - Multi-Table Support)

### Goals

1. **Multiple Source Tables** - Sync data from multiple BigQuery tables simultaneously
2. **Per-Table Configuration** - Each table can have its own column selection, batch sizes, and settings
3. **Per-Table Harper Tables** - Each BigQuery source maps to a separate Harper table
4. **Independent Sync Loops** - Each table syncs independently with its own checkpoint
5. **Backward Compatibility** - Existing single-table configurations continue to work

### Configuration Design

#### Option A: Array-Based Configuration

```yaml
bigquery:
  projectId: irjudson-demo
  credentials: service-account-key.json
  location: US

  # Multiple tables configuration
  tables:
    - dataset: maritime_tracking
      table: vessel_positions
      timestampColumn: timestamp
      columns: [timestamp, mmsi, vessel_name, latitude, longitude, speed_knots]
      targetTable: VesselPositions    # Harper table name
      sync:
        initialBatchSize: 10000
        catchupBatchSize: 1000
        steadyBatchSize: 500

    - dataset: maritime_tracking
      table: port_events
      timestampColumn: event_time
      columns: [event_time, port_id, vessel_mmsi, event_type, status]
      targetTable: PortEvents
      sync:
        initialBatchSize: 5000
        catchupBatchSize: 500
        steadyBatchSize: 100

    - dataset: weather_data
      table: conditions
      timestampColumn: observed_at
      columns: "*"  # Sync all columns
      targetTable: WeatherConditions
      sync:
        initialBatchSize: 1000
        catchupBatchSize: 500
        steadyBatchSize: 100

# Global defaults (used if not specified per-table)
sync:
  initialBatchSize: 10000
  catchupBatchSize: 1000
  steadyBatchSize: 500
  catchupThreshold: 3600
  steadyThreshold: 300
  pollInterval: 30000

retry:
  maxAttempts: 5
  backoffMultiplier: 2
  initialDelay: 1000
```

#### Backward Compatibility Strategy

```javascript
// config-loader.js enhancement
export function getPluginConfig(config = null) {
  const fullConfig = config || loadConfig();

  if (!fullConfig.bigquery) {
    throw new Error('bigquery section missing in config.yaml');
  }

  // Check if new multi-table format
  if (fullConfig.bigquery.tables && Array.isArray(fullConfig.bigquery.tables)) {
    return getMultiTableConfig(fullConfig);
  }

  // Legacy single-table format
  return getSingleTableConfig(fullConfig);
}
```

### Architecture Changes

#### 1. SyncEngine Refactoring

**Current:** Single SyncEngine manages one table

**Future:** SyncOrchestrator manages multiple TableSyncEngines

```javascript
// NEW: src/sync-orchestrator.js
export class SyncOrchestrator {
  constructor(config) {
    this.config = config;
    this.tableSyncEngines = [];

    // Create one TableSyncEngine per table
    for (const tableConfig of config.tables) {
      const engine = new TableSyncEngine(tableConfig);
      this.tableSyncEngines.push(engine);
    }
  }

  async initialize() {
    // Initialize all table sync engines
    await Promise.all(
      this.tableSyncEngines.map(engine => engine.initialize())
    );
  }

  async startAll() {
    // Start all sync loops
    this.tableSyncEngines.forEach(engine => engine.start());
  }

  async stopAll() {
    // Stop all sync loops
    await Promise.all(
      this.tableSyncEngines.map(engine => engine.stop())
    );
  }
}

// REFACTORED: src/table-sync-engine.js
// Current SyncEngine becomes TableSyncEngine
// Manages sync for a single table
export class TableSyncEngine {
  constructor(tableConfig) {
    this.tableConfig = tableConfig;
    this.client = new BigQueryClient(tableConfig);
    this.targetTable = tableConfig.targetTable;
    // ... rest of current SyncEngine logic
  }
}
```

#### 2. Schema Management

**Current:** Single `BigQueryData` table with generic schema

**Future:** Dynamic table creation per source

```graphql
# schema/harper-bigquery-sync.graphql

# Generic table for single-table legacy mode
type BigQueryData @table {
  id: ID @primaryKey
  # Dynamic fields from BigQuery
  _syncedAt: Date @createdTime
}

# Per-table checkpoints (supports multiple tables)
type SyncCheckpoint @table {
  id: ID @primaryKey  # Composite: "{tableId}_{nodeId}"
  tableId: String! @indexed
  nodeId: Int!
  lastTimestamp: Date!
  recordsIngested: Long!
  lastSyncTime: Date!
  phase: String!
  batchSize: Int!
}

# Audit log with table tracking
type SyncAudit @table {
  id: ID! @primaryKey
  timestamp: Date! @indexed @createdTime
  tableId: String @indexed
  nodeId: Int
  status: String!
  reason: String
  recordSample: String
}

# Example: Vessel positions table (user-defined)
type VesselPositions @table {
  id: ID @primaryKey
  timestamp: Date @indexed
  mmsi: String @indexed
  vessel_name: String
  latitude: Float
  longitude: Float
  speed_knots: Float
  _syncedAt: Date @createdTime
}

# Example: Port events table (user-defined)
type PortEvents @table {
  id: ID @primaryKey
  event_time: Date @indexed
  port_id: String @indexed
  vessel_mmsi: String @indexed
  event_type: String
  status: String
  _syncedAt: Date @createdTime
}
```

**Schema Generation Strategy:**
- Users manually define Harper tables for each BigQuery source
- Plugin validates that target tables exist
- Alternatively: Auto-generate schema from BigQuery table schema

#### 3. Checkpoint Management

**Current:** Single checkpoint per node

**Future:** Checkpoint per table per node

```javascript
// Example checkpoint structure
{
  id: "vessel_positions_0",  // tableId_nodeId
  tableId: "vessel_positions",
  nodeId: 0,
  lastTimestamp: "2025-11-10T12:00:00.000Z",
  recordsIngested: 125000,
  lastSyncTime: "2025-11-10T12:05:00.000Z",
  phase: "steady",
  batchSize: 500
}
```

#### 4. Resource Endpoints

**Current:** Single endpoints for sync control

**Future:** Per-table and global endpoints

```javascript
// src/resources.js enhancements

// Global controls
POST /SyncControl { "action": "start" }      // Start all tables
POST /SyncControl { "action": "stop" }       // Stop all tables
GET  /SyncStatus                             // Status of all tables

// Per-table controls
POST /SyncControl/:tableId { "action": "start" }
POST /SyncControl/:tableId { "action": "stop" }
GET  /SyncStatus/:tableId

// GraphQL enhancements
query {
  # All checkpoints
  SyncCheckpoint {
    tableId
    nodeId
    lastTimestamp
    phase
  }

  # Checkpoints for specific table
  SyncCheckpoint(filter: { tableId: { eq: "vessel_positions" } }) {
    nodeId
    lastTimestamp
    phase
  }
}
```

### Implementation Steps

#### Phase 2.1: Core Architecture (Estimated: 2-3 weeks)

1. **Week 1: Config & Validation**
   - [ ] Extend config-loader.js to support tables array
   - [ ] Add multi-table validation logic
   - [ ] Maintain backward compatibility with single-table config
   - [ ] Update config.yaml examples
   - [ ] Write unit tests for multi-table config parsing

2. **Week 2: Engine Refactoring**
   - [ ] Create SyncOrchestrator class
   - [ ] Refactor SyncEngine → TableSyncEngine
   - [ ] Implement per-table checkpointing
   - [ ] Update schema with composite checkpoint IDs
   - [ ] Write unit tests for orchestrator

3. **Week 3: Integration & Testing**
   - [ ] Update resource endpoints for multi-table control
   - [ ] Add GraphQL queries for per-table status
   - [ ] Write integration tests
   - [ ] Test with 2-3 tables simultaneously
   - [ ] Performance testing

#### Phase 2.2: Advanced Features (Estimated: 1-2 weeks)

4. **Advanced Sync Management**
   - [ ] Per-table sync pause/resume
   - [ ] Dynamic table addition (without restart)
   - [ ] Table-specific error handling
   - [ ] Per-table retry policies
   - [ ] Table prioritization (which tables sync first)

5. **Monitoring & Observability**
   - [ ] Per-table metrics
   - [ ] Table sync health checks
   - [ ] Dashboard showing all table statuses
   - [ ] Alerting for table-specific issues

#### Phase 2.3: Schema Automation (Optional, Estimated: 1 week)

6. **Auto-Schema Generation**
   - [ ] Query BigQuery table schema
   - [ ] Generate Harper GraphQL schema
   - [ ] Type mapping (BigQuery → Harper types)
   - [ ] Handle schema evolution

### Testing Strategy

#### Unit Tests
- Multi-table config parsing
- Orchestrator lifecycle management
- Per-table checkpoint isolation
- Config validation with multiple tables

#### Integration Tests
- Sync 3 tables simultaneously
- Verify data isolation between tables
- Test checkpoint independence
- Verify resource endpoints work per-table

#### Performance Tests
- Benchmark with 5, 10, 20 tables
- Measure memory usage scaling
- CPU usage with multiple sync loops
- Identify bottlenecks

### Migration Path

#### For Existing Users (Single Table)

**No changes required!** Existing configurations continue to work:

```yaml
# This still works (legacy format)
bigquery:
  projectId: my-project
  dataset: my_dataset
  table: my_table
  timestampColumn: timestamp
  columns: [timestamp, id, name]
```

#### For New Multi-Table Users

```yaml
# New format
bigquery:
  projectId: my-project
  tables:
    - dataset: dataset1
      table: table1
      ...
    - dataset: dataset2
      table: table2
      ...
```

### Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing deployments | High | Maintain backward compatibility, thorough testing |
| Performance degradation | Medium | Benchmark early, optimize orchestrator |
| Checkpoint corruption | High | Robust error handling, checkpoint validation |
| Memory issues with many tables | Medium | Implement table limits, monitor memory |
| Complex configuration errors | Medium | Comprehensive validation, clear error messages |

### Success Criteria

- ✅ Sync 10+ tables simultaneously without performance degradation
- ✅ 100% backward compatibility with single-table configs
- ✅ Per-table control and monitoring
- ✅ Comprehensive test coverage (>90%)
- ✅ Clear documentation and migration guide
- ✅ Zero data loss during multi-table sync

### Open Questions

1. **Table Limit:** Should we enforce a maximum number of tables per instance?
2. **Resource Allocation:** How to fairly allocate resources across tables?
3. **Startup Order:** Should tables start in sequence or parallel?
4. **Schema Validation:** Should we validate Harper schema matches BigQuery schema?
5. **Dynamic Addition:** Support adding tables without restart?

### References

- Phase 1 Implementation: `docs/design-document.md`
- Query Builder: `src/query-builder.js`
- Type Converter: `src/type-converter.js`
- Validation: `src/validators.js`

---

**Document Status:** Draft for Discussion
**Last Updated:** 2025-11-10
**Authors:** Claude Code
