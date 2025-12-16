// ============================================================================
// File: sync-control-manager.js
// Manages cluster-wide sync control via replicated state table
// ============================================================================

/* global logger */

export class SyncControlManager {
	constructor(syncEngines) {
		logger.info('[SyncControlManager] Constructor called');
		this.syncEngines = syncEngines;
		this.lastProcessedVersion = 0;
		this.currentState = 'stopped';
		this.isProcessing = false;
		this.subscription = null;
		this.failedEngines = [];
		logger.info(`[SyncControlManager] Initialized with ${syncEngines.length} engines`);
	}

	async initialize() {
		logger.info('[SyncControlManager.initialize] Starting initialization');
		const STATE_ID = 'sync-control';

		// Load current state from table
		const currentState = await tables.SyncControlState.get(STATE_ID);

		if (currentState) {
			logger.info(
				`[SyncControlManager.initialize] Found existing state: ${currentState.command} (v${currentState.version})`
			);
			this.lastProcessedVersion = currentState.version;
			// Apply current state to engines
			await this.processCommand(currentState);
		} else {
			// Initialize state on first run
			logger.info('[SyncControlManager.initialize] No state found, initializing to stopped');
			await tables.SyncControlState.put({
				id: STATE_ID,
				command: 'stop',
				commandedAt: new Date(),
				commandedBy: 'system-init',
				version: 0,
			});
		}

		// Subscribe to future changes
		logger.info('[SyncControlManager.initialize] Setting up subscription');
		this.subscription = await tables.SyncControlState.subscribe({ id: STATE_ID });
		this.startSubscriptionLoop();

		logger.info('[SyncControlManager.initialize] Initialization complete');
	}

	async processCommand(state) {
		logger.info(`[SyncControlManager.processCommand] Command: ${state.command} (v${state.version})`);
		// TODO: Implement command processing
	}

	async startSubscriptionLoop() {
		logger.info('[SyncControlManager.startSubscriptionLoop] Starting loop');
		// TODO: Implement subscription loop
	}

	getStatus() {
		return {
			currentState: this.currentState,
			lastProcessedVersion: this.lastProcessedVersion,
			engines: this.syncEngines.map((engine) => ({
				tableId: engine.tableId,
				running: engine.running,
				phase: engine.currentPhase,
			})),
			failedEngines: this.failedEngines,
			isProcessing: this.isProcessing,
		};
	}
}
