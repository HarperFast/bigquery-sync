# Dynamic Table Creation via Harper Operations API

**Date:** 2025-11-13
**Status:** ✅ Implemented (with significant simplifications)
**Issue:** [#7](https://github.com/HarperFast/harper-bigquery-sync/issues/7)

## Implementation Notes (2025-11-14)

**Key Discovery:** Harper Operations API is fully schemaless - tables automatically index ALL fields without pre-definition.

**What We Actually Built:**

- ✅ `OperationsClient` - Simple HTTP client for `describe_table` and `create_table` operations
- ✅ `SchemaManager` - Ensures tables exist before syncing (no complex migrations needed)
- ✅ `TypeMapper` - Maps BigQuery types to Harper types (for documentation only)
- ✅ `IndexStrategy` - Documents which fields will be indexed (Harper does this automatically)
- ✅ Integer ID generation - Deterministic SHA256-based integer IDs for fast indexing
- ✅ Integration in `src/index.js` - SchemaManager runs before SyncEngines start

**What We Didn't Need:**

- ❌ `SchemaLeaderElection` - No schema polling needed (Harper handles evolution automatically)
- ❌ Schema migration logic - Just insert data, Harper auto-indexes new fields
- ❌ `addColumns()` operation - Not supported by Operations API, not needed
- ❌ Distributed locking for schema checks - No concurrent schema checks required
- ❌ Complex type change handling - All fields are schemaless

**How It Works:**

1. On startup, `SchemaManager.ensureTable()` checks if Harper table exists
2. If not, creates table with `create_table` operation (only requires `hash_attribute`)
3. `SyncEngine` inserts BigQuery data with integer IDs
4. Harper automatically indexes ALL inserted fields (no schema pre-definition)
5. New fields in BigQuery are automatically handled on next insert

**Benefits Over Original Design:**

- Much simpler implementation (no polling, no migrations, no locking)
- Zero ongoing overhead (no periodic schema checks)
- Automatic schema evolution (Harper handles everything)
- Fast integer primary keys for optimal performance
- Thread-safe by design (idempotent table creation)

**Test Coverage:** 97 tests passing (91 main + 6 integer ID tests)

---

## Original Design (Preserved for Reference)

## Overview

Enable automatic creation and management of Harper destination tables using the Operations API, eliminating the need for manual schema.graphql definitions. Tables are created dynamically based on BigQuery schema introspection with full type mapping, smart indexing, and safe schema evolution.

## Goals

1. **Zero manual schema definition** - No schema.graphql entries required for data tables
2. **Thread-safe and idempotent** - Multiple nodes can start simultaneously without conflicts
3. **No data destruction** - Schema changes only add, never remove or modify destructively
4. **Rich type mapping** - Faithful representation of BigQuery types including nested structures
5. **Smart indexing** - Automatic index creation based on BigQuery metadata and patterns
6. **Adaptive schema polling** - Detect BigQuery schema changes with minimal overhead

## Architecture

### Core Components

#### 1. SchemaManager

Central orchestrator for all table schema operations.

**Responsibilities:**

- Discovers BigQuery table schemas via API metadata
- Creates Harper tables using Operations API
- Migrates schemas by adding new columns
- Manages adaptive schema change polling
- Implements thread-safe check-then-act pattern

**Key Methods:**

```javascript
async ensureTable(harperTable, bqDataset, bqTable, timestampColumn)
async introspectBigQuerySchema(dataset, table)
async migrateSchema(tableName, bigQuerySchema, harperSchema)
startPolling()
stop()
```

#### 2. TypeMapper

Bidirectional type conversion between BigQuery and Harper.

**Responsibilities:**

- Maps all BigQuery types to Harper equivalents
- Handles nested RECORD/STRUCT types recursively
- Maps REPEATED fields to arrays
- Provides safe fallback for unknown types

**Type Mapping Table:**
| BigQuery Type | Harper Type | Notes |
|--------------|-------------|-------|
| INTEGER, INT64 | number | All numeric types |
| FLOAT, FLOAT64, NUMERIC | number | Floating point |
| STRING, BYTES | string | Text and binary |
| BOOL, BOOLEAN | boolean | Boolean |
| TIMESTAMP, DATE, TIME, DATETIME | string | ISO 8601 format |
| RECORD, STRUCT | object | Nested structure |
| REPEATED (any) | array | Array wrapper |
| GEOGRAPHY | string | GeoJSON format |
| JSON | object | Native JSON |

#### 3. OperationsClient

Clean wrapper around Harper Operations API.

**Responsibilities:**

- HTTP communication with Harper Operations API
- Authentication (Basic Auth)
- Error translation (404 → null, etc.)
- Request/response formatting

**API Methods:**

```javascript
async describeTable(tableName)
async createTable({ table, primary_key, attributes })
async addColumns(tableName, attributes)
```

#### 4. IndexStrategy

Determines which columns to index automatically.

**Indexing Logic:**

1. **Guaranteed:** Configured timestamp column (required for sync queries)
2. **BigQuery partitioning:** Partitioning field from table metadata
3. **BigQuery clustering:** All clustering columns
4. **Pattern detection:**
   - Columns ending in `_id`
   - Common names: `id`, `user_id`, `created_at`, `updated_at`
   - Columns with `time` or `date` in name

**Avoids indexing:**

- Large text fields (performance penalty)
- Array fields (complex to index)
- Nested objects (poor index candidates)

#### 5. SchemaLeaderElection

Manages distributed locking for schema checks - only one node checks at a time.

**Lock-Based Polling:**

- Uses `SchemaLock` table with TTL for distributed coordination
- One node acquires lock, becomes "schema leader"
- Leader checks all schemas and performs migrations
- Lock expires after check (or on crash), other nodes can acquire
- **Initial interval:** 5 minutes (detect changes quickly)
- **After 3 stable checks:** Back off by 1.5x
- **Maximum interval:** 30 minutes
- **On schema change:** Reset to 5 minutes

**Benefits:**

- Eliminates redundant BigQuery API calls (N nodes → 1 node checking)
- No race conditions on schema migrations
- Automatic failover if leader crashes (lock expires)
- Dramatically reduced Harper Operations API load

## Thread-Safety & Concurrency

### Check-Then-Act with Retry Pattern

```javascript
async ensureTable(tableName, bigQuerySchema) {
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      // Step 1: Check if table exists
      const harperSchema = await this.operationsClient.describeTable(tableName);

      if (harperSchema) {
        // Table exists - validate and migrate if needed
        return await this.migrateSchema(tableName, bigQuerySchema, harperSchema);
      }

      // Step 2: Table doesn't exist - try to create it
      const attributes = this.typeMapper.mapSchema(bigQuerySchema);
      const indexes = this.indexStrategy.determineIndexes(bigQuerySchema);

      await this.operationsClient.createTable({
        table: tableName,
        primary_key: 'id',
        attributes: attributes
      });

      return { created: true };

    } catch (error) {
      if (error.message.includes('already exists')) {
        // Race condition: another node created it. Retry describe.
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to ensure table after ${maxAttempts} attempts`);
}
```

**Safety Features:**

- No destructive operations - only creates and adds columns
- "Already exists" errors treated as success (idempotent)
- Exponential backoff prevents thundering herd
- Multiple attempts handle race conditions gracefully
- All nodes eventually converge to same schema state

## Schema Migration & Evolution

### Automatic Migration Strategy

When BigQuery schema changes are detected:

**New Columns:** Automatically added via `addColumns()` operation. Safe - no data affected.

**Type Changes:** Create versioned column (e.g., `columnName_v2`) with new type. Original column preserved for data safety. Generates warning log for manual cleanup.

**Deleted Columns:** Not handled - BigQuery columns don't disappear, data continues syncing with all fields.

### Migration Flow

```javascript
async migrateSchema(tableName, bigQuerySchema, harperSchema) {
  const changes = this.detectSchemaChanges(bigQuerySchema, harperSchema);

  if (changes.newColumns.length === 0 && changes.typeChanges.length === 0) {
    return { upToDate: true };
  }

  // Add new columns - safe operation
  if (changes.newColumns.length > 0) {
    const newAttributes = changes.newColumns.map(col =>
      this.typeMapper.mapColumn(col)
    );
    await this.operationsClient.addColumns(tableName, newAttributes);
  }

  // Handle type changes - create versioned columns
  if (changes.typeChanges.length > 0) {
    const versionedColumns = [];

    for (const change of changes.typeChanges) {
      const versionedName = `${change.columnName}_v2`;
      versionedColumns.push(this.typeMapper.mapColumn({
        name: versionedName,
        type: change.newType,
        mode: change.mode
      }));

      logger.warn(
        `Type change: ${tableName}.${change.columnName} ` +
        `(${change.oldType} → ${change.newType}). ` +
        `Creating versioned column: ${versionedName}. ` +
        `FLAG FOR MANUAL CLEANUP.`
      );
    }

    await this.operationsClient.addColumns(tableName, versionedColumns);
  }

  return { migrated: true };
}
```

**Safety Guarantees:**

- Never drops columns
- Never modifies existing column types
- Preserves all existing data
- Clear warning logs for manual intervention
- Continues syncing without interruption

## Distributed Schema Polling with Leader Election

### Lock-Based Coordination

**Problem:** Having every node independently poll for schema changes wastes API calls and can cause race conditions during migrations.

**Solution:** Use distributed locking so only one node (the "schema leader") checks schemas at any given time.

### SchemaLock Table

```graphql
type SchemaLock @table {
	lockId: String! @primaryKey # Always "schema_check"
	nodeId: String! # Which node holds the lock
	acquiredAt: Date! # When lock was acquired
	expiresAt: Date! @indexed # TTL for automatic release
}
```

### Lock Acquisition Flow

```javascript
class SchemaLeaderElection {
	constructor(schemaManager, operationsClient) {
		this.schemaManager = schemaManager;
		this.operationsClient = operationsClient;
		this.nodeId = `${os.hostname()}-${process.pid}`;

		// Adaptive timing
		this.currentInterval = 5 * 60 * 1000; // 5 minutes
		this.minInterval = 5 * 60 * 1000;
		this.maxInterval = 30 * 60 * 1000; // 30 minutes
		this.backoffMultiplier = 1.5;
		this.consecutiveNoChanges = 0;
	}

	async tryAcquireLock() {
		const now = new Date();
		const lockExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10min TTL

		try {
			// Try to insert lock record
			await this.operationsClient.insert('SchemaLock', {
				lockId: 'schema_check',
				nodeId: this.nodeId,
				acquiredAt: now,
				expiresAt: lockExpiry,
			});

			return true; // Successfully acquired
		} catch (error) {
			if (error.message.includes('already exists')) {
				// Lock held by another node - check if expired
				const existingLock = await this.operationsClient.get('SchemaLock', 'schema_check');

				if (new Date() > new Date(existingLock.expiresAt)) {
					// Lock expired - delete and retry
					await this.operationsClient.delete('SchemaLock', 'schema_check');
					return await this.tryAcquireLock(); // Retry once
				}

				return false; // Lock still valid, held by another node
			}
			throw error;
		}
	}

	async releaseLock() {
		try {
			await this.operationsClient.delete('SchemaLock', 'schema_check');
		} catch (error) {
			// Ignore errors on release (lock may have expired)
			logger.debug(`Lock release failed: ${error.message}`);
		}
	}

	async checkSchemas() {
		// Try to become schema leader
		const acquired = await this.tryAcquireLock();

		if (!acquired) {
			logger.debug('Schema check skipped - another node is leader');
			return;
		}

		logger.info(`Node ${this.nodeId} is schema leader - checking schemas`);

		try {
			// Check all configured tables
			let hasChanges = false;

			for (const tableConfig of this.allTables) {
				const result = await this.schemaManager.ensureTable(
					tableConfig.targetTable,
					tableConfig.dataset,
					tableConfig.table,
					tableConfig.timestampColumn
				);

				if (result.migrated || result.created) {
					hasChanges = true;
				}
			}

			// Adjust polling interval based on changes
			if (hasChanges) {
				logger.info('Schema changes detected - resetting poll interval');
				this.currentInterval = this.minInterval;
				this.consecutiveNoChanges = 0;
			} else {
				this.consecutiveNoChanges++;

				if (this.consecutiveNoChanges >= 3) {
					this.currentInterval = Math.min(this.currentInterval * this.backoffMultiplier, this.maxInterval);
					logger.debug(`No changes, backing off to ${this.currentInterval / 60000} min`);
				}
			}
		} finally {
			// Always release lock
			await this.releaseLock();
		}
	}

	start() {
		this.timer = setInterval(() => this.checkSchemas(), this.currentInterval);
	}

	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.releaseLock(); // Release if we hold it
		}
	}
}
```

### Benefits

**API Efficiency:**

- 10 nodes polling = 10x BigQuery API calls → 1 node polling = 1x API calls
- Dramatically reduced BigQuery metadata query costs
- Minimal Harper Operations API load

**No Race Conditions:**

- Only one node performs migrations at a time
- No conflicts when adding columns
- Clean serialized schema evolution

**Automatic Failover:**

- If leader crashes, lock expires (10min TTL)
- Other nodes can acquire lock and become leader
- No manual intervention needed

**Adaptive Performance:**

- Starts frequent (5min) for quick detection
- Backs off to 30min for stable schemas
- Resets to 5min when changes detected

## Integration with Existing Codebase

### Modified handleApplication Flow

```javascript
// src/index.js
export async function handleApplication(scope) {
	const logger = scope.logger;
	const options = scope.options.getAll();
	const fullConfig = getPluginConfig(options);

	// Initialize SchemaManager once for all tables
	const schemaManager = new SchemaManager({
		bigquery: fullConfig.bigquery,
		harperEndpoint: options.OPERATIONSAPI_URL,
		harperUsername: options.OPERATIONSAPI_USER,
		harperPassword: options.OPERATIONSAPI_PASS,
	});

	const syncEngines = [];

	for (const tableConfig of fullConfig.bigquery.tables) {
		// CRITICAL: Ensure Harper table exists before syncing
		await schemaManager.ensureTable(
			tableConfig.targetTable, // Harper table name
			tableConfig.dataset, // BigQuery dataset
			tableConfig.table, // BigQuery table
			tableConfig.timestampColumn // For indexing
		);

		const syncEngine = new SyncEngine(tableConfig);
		await syncEngine.initialize();
		syncEngines.push(syncEngine);
	}

	// Start distributed schema polling with leader election
	const schemaLeaderElection = new SchemaLeaderElection(schemaManager, fullConfig.bigquery.tables);
	schemaLeaderElection.start();

	globals.set('syncEngines', syncEngines);
	globals.set('schemaManager', schemaManager);
	globals.set('schemaLeaderElection', schemaLeaderElection);
}
```

### System Tables

**Remain in schema.graphql:**

- `SyncCheckpoint` - Fixed schema, system-controlled
- `SyncAudit` - Fixed schema, system-controlled
- `SchemaLock` - Distributed locking for schema polling coordination

**Dynamically created:**

- All data tables from BigQuery (e.g., `VesselPositions`, `PortEvents`, etc.)

This hybrid approach maintains clean separation between infrastructure and user data.

## Error Handling

### Error Categories

**1. Validation Errors**

- Invalid configuration (missing table names)
- Timestamp column not found in BigQuery schema
- **Action:** Fail fast with clear, actionable error message

**2. Permission Errors**

- Missing BigQuery `bigquery.tables.get` permission
- Missing Harper Operations API access
- **Action:** Surface permission error with required permissions list

**3. Network Errors**

- BigQuery API timeout
- Harper API unreachable
- **Action:** Retry with exponential backoff

**4. Race Conditions**

- Multiple nodes creating same table
- **Action:** Handled by check-then-act pattern with retries

**5. Schema Conflicts**

- Column type changed in BigQuery
- **Action:** Create versioned column, log warning, continue syncing

### Circuit Breaker Pattern

Prevents cascading failures when Harper or BigQuery is unavailable:

```javascript
async withCircuitBreaker(operation, operationName) {
  if (this.circuitOpen) {
    const timeSinceOpen = Date.now() - this.circuitOpenedAt;
    if (timeSinceOpen < 60000) { // 1 minute timeout
      throw new Error(`Circuit breaker open for ${operationName}`);
    }
    this.circuitOpen = false; // Try to reset
  }

  try {
    const result = await operation();
    this.consecutiveFailures = 0;
    return result;
  } catch (error) {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 5) {
      this.circuitOpen = true;
      this.circuitOpenedAt = Date.now();
    }
    throw error;
  }
}
```

**Behavior:**

- Opens after 5 consecutive failures
- Auto-resets after 1 minute
- Protects both BigQuery and Harper from overload

## Testing Strategy

### Unit Tests

Test pure logic without I/O:

```javascript
describe('TypeMapper', () => {
	it('should map BigQuery INTEGER to Harper number');
	it('should map REPEATED fields to arrays');
	it('should create versioned columns for type changes');
});

describe('IndexStrategy', () => {
	it('should always index configured timestamp column');
	it('should detect BigQuery clustering columns');
	it('should avoid indexing large text fields');
});
```

### Integration Tests

Test component interactions with mocked APIs:

```javascript
describe('SchemaManager Integration', () => {
	beforeEach(() => {
		mockBigQuery = { getMetadata: async () => mockSchema };
		mockOperationsClient = {
			describeTable: async () => null,
			createTable: async () => ({ message: 'created' }),
		};
	});

	it('should create table if not exists');
	it('should handle concurrent creates gracefully');
	it('should migrate schema when BigQuery schema changes');
});
```

### Concurrency Tests

Verify thread-safety:

```javascript
describe('Concurrent Operations', () => {
	it('should handle 10 nodes creating same table simultaneously');
	it('should eventually converge to identical schema');
	it('should not lose any schema changes during conflicts');
});
```

### End-to-End Tests

Optional tests with real services (gated by env var):

```javascript
describe('E2E Schema Management', () => {
	before(function () {
		if (!process.env.TEST_LIVE_SERVICES) this.skip();
	});

	it('should create table from real BigQuery schema');
	it('should detect and migrate schema changes');
});
```

## Configuration

No new configuration required for basic operation. The feature uses existing BigQuery credentials and Harper endpoint settings.

**Optional Environment Variables:**

- `OPERATIONSAPI_URL` - Harper Operations API endpoint (default: `http://localhost:9925`)
- `OPERATIONSAPI_USER` - Harper username (default: `admin`)
- `OPERATIONSAPI_PASS` - Harper password (from existing config)

## Migration Path

### For Existing Deployments

**Phase 1: Parallel Operation (v1.0)**

- Keep existing schema.graphql for data tables
- Add dynamic table creation as opt-in feature flag
- Users can gradually migrate tables to dynamic creation

**Phase 2: Full Migration (v2.0)**

- Remove data table definitions from schema.graphql
- Only system tables (`SyncCheckpoint`, `SyncAudit`) remain
- Dynamic creation becomes default and only method

### Breaking Changes

**v2.0 will require:**

- Access to Harper Operations API (port 9925)
- `OPERATIONSAPI_USER` and `OPERATIONSAPI_PASS` configured
- Removal of data table definitions from schema.graphql

## Implementation Checklist

- [ ] Create `src/schema-manager.js` with SchemaManager class
- [ ] Create `src/type-mapper.js` with TypeMapper class
- [ ] Create `src/operations-client.js` with OperationsClient class
- [ ] Create `src/index-strategy.js` with IndexStrategy class
- [ ] Create `src/schema-leader-election.js` with SchemaLeaderElection class
- [ ] Add SchemaLock table to schema.graphql
- [ ] Modify `src/index.js` handleApplication to use SchemaManager
- [ ] Add unit tests for TypeMapper
- [ ] Add unit tests for IndexStrategy
- [ ] Add integration tests for SchemaManager
- [ ] Add concurrency tests for race conditions
- [ ] Update documentation for Operations API requirements
- [ ] Update schema.graphql to remove example data tables
- [ ] Add error messages for missing Operations API access
- [ ] Test with multi-node Harper cluster
- [ ] Verify adaptive polling reduces to 30min intervals
- [ ] Test schema migration with type changes

## Future Enhancements

### Dynamic System Tables

Currently `SyncCheckpoint` and `SyncAudit` remain in schema.graphql. Future enhancement: create these dynamically too, making schema.graphql completely optional.

### Schema Version Tracking

Track schema versions in a `SchemaMetadata` table. Enables:

- Audit trail of schema changes
- Rollback capability
- Version-aware queries

### Manual Schema Override

Add config option to override automatic type mapping:

```yaml
tables:
  - id: vessel_positions
    schemaOverrides:
      latitude: { type: 'number', indexed: true }
      tags: { type: 'array' }
```

### Schema Diffing API

Expose endpoint to view schema differences:

```bash
GET /SchemaDiff?table=vessel_positions
# Returns: added columns, type changes, index changes
```

## Success Metrics

- **Zero manual schema updates** - No schema.graphql changes for new tables
- **Thread-safe initialization** - 10+ nodes start simultaneously without conflicts
- **Fast schema detection** - Changes detected within 5 minutes
- **Low API overhead** - Schema checks back off to 30 minutes for stable tables
- **Zero data loss** - Type changes create versioned columns, never destroy data

## References

- [Harper Operations API Documentation](https://docs.harperdb.io/docs/developers/operations-api)
- [BigQuery Table Metadata API](https://cloud.google.com/bigquery/docs/reference/rest/v2/tables/get)
- [Issue #7: Dynamic Harper table creation](https://github.com/HarperFast/harper-bigquery-sync/issues/7)
