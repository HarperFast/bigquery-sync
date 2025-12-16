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
		// TODO: Implement in next task
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
