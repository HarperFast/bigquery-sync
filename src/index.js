// my plugin entry point
import { globals } from './globals.js';

import { SyncEngine } from './sync-engine.js';
import { getPluginConfig, getTableConfig } from './config-loader.js';
import { ValidationService } from './validation.js';
import { SchemaManager } from './schema-manager.js';
import { BigQueryClient } from './bigquery-client.js';

export async function handleApplication(scope) {
	const logger = scope.logger;
	const options = scope.options.getAll();

	// Load and normalize configuration (converts legacy single-table to multi-table format)
	const fullConfig = getPluginConfig(options);

	// Initialize SchemaManager for dynamic table creation via Operations API
	// This eliminates the need for manual schema.graphql definitions
	let schemaManager = null;
	try {
		// Create BigQueryClient for schema introspection
		const bigQueryClient = new BigQueryClient({
			projectId: fullConfig.bigquery.projectId,
			credentialsPath: fullConfig.bigquery.credentials,
			location: fullConfig.bigquery.location,
			config: fullConfig,
		});

		// Configure Operations API (prioritize config.yaml, fallback to env vars)
		const operationsConfig = {
			operations: {
				host: fullConfig.operations?.host || options.OPERATIONSAPI_HOST || 'localhost',
				port: fullConfig.operations?.port || parseInt(options.OPERATIONSAPI_PORT) || 9925,
				username: fullConfig.operations?.username || options.OPERATIONSAPI_USER || 'admin',
				password: fullConfig.operations?.password || options.OPERATIONSAPI_PASS || 'password',
			},
			bigquery: fullConfig.bigquery,
		};

		schemaManager = new SchemaManager({
			bigQueryClient,
			config: operationsConfig,
		});

		logger.info('[handleApplication] SchemaManager initialized for dynamic table creation');
	} catch (error) {
		logger.warn(
			`[handleApplication] SchemaManager initialization failed: ${error.message}. ` +
				`Tables must be pre-defined in schema.graphql. ` +
				`To enable dynamic table creation, configure Operations API credentials.`
		);
	}

	// Create a SyncEngine for each table
	// NOTE: This is a simple sequential loop for now. In the future, this can easily be
	// refactored to create parallel SyncEngines (one-line change to SyncOrchestrator pattern)
	const syncEngines = [];

	logger.info(`[handleApplication] Initializing sync for ${fullConfig.bigquery.tables.length} tables`);

	for (const tableConfig of fullConfig.bigquery.tables) {
		logger.info(
			`[handleApplication] Creating SyncEngine for table: ${tableConfig.id} (${tableConfig.table}) -> ${tableConfig.targetTable}`
		);

		// Ensure Harper table exists (dynamic table creation)
		if (schemaManager) {
			try {
				const ensureResult = await schemaManager.ensureTable(
					tableConfig.targetTable,
					tableConfig.dataset,
					tableConfig.table,
					tableConfig.timestampColumn
				);

				if (ensureResult.action === 'created') {
					logger.info(
						`[handleApplication] Created Harper table ${tableConfig.targetTable} ` +
							`(integer id for fast indexing, ${ensureResult.expectedFields?.length || 0} fields expected)`
					);
				} else {
					logger.info(
						`[handleApplication] Harper table ${tableConfig.targetTable} exists ` +
							`(Harper will auto-index any new fields during sync)`
					);
				}
			} catch (error) {
				logger.error(
					`[handleApplication] Failed to ensure table ${tableConfig.targetTable}: ${error.message}. ` +
						`Make sure the table is defined in schema.graphql or Operations API is accessible.`
				);
				throw error;
			}
		}

		// Get table-specific configuration
		const tableSpecificConfig = getTableConfig(tableConfig.id, fullConfig);

		// Create and initialize SyncEngine for this table
		const syncEngine = new SyncEngine(tableSpecificConfig);
		await syncEngine.initialize();

		syncEngines.push(syncEngine);

		logger.info(`[handleApplication] SyncEngine initialized for table: ${tableConfig.id}`);
	}

	// Store all sync engines in globals
	globals.set('syncEngines', syncEngines);

	// For backward compatibility, also store the first engine as 'syncEngine'
	if (syncEngines.length > 0) {
		globals.set('syncEngine', syncEngines[0]);
	}

	// Store SchemaManager in globals (if available)
	if (schemaManager) {
		globals.set('schemaManager', schemaManager);
	}

	logger.info(`[handleApplication] All SyncEngines initialized (${syncEngines.length} tables)`);

	// Initialize ValidationService with full config (optional - only if config is complete)
	try {
		if (fullConfig.bigquery && fullConfig.bigquery.tables && fullConfig.bigquery.tables.length > 0) {
			const validationService = new ValidationService(fullConfig);
			globals.set('validator', validationService);
			logger.info('[handleApplication] ValidationService initialized');
		} else {
			logger.warn('[handleApplication] ValidationService not initialized - no tables configured');
		}
	} catch (error) {
		logger.warn(
			`[handleApplication] ValidationService initialization failed: ${error.message}. Validation will be disabled.`
		);
	}
}
