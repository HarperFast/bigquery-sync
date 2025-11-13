# Project TODO List

Consolidated task list for Harper BigQuery Sync plugin and Maritime Data Synthesizer.

## High Priority

### Production Readiness

- [ ] **Add exponential backoff for transient BigQuery errors** (docs/design-document.md)
  - Currently errors are retried with simple logic
  - Need exponential backoff strategy for transient failures
  - Prevents overwhelming BigQuery API during issues

- [ ] **Production deployment documentation**
  - Fabric deployment guide with one-click setup
  - Self-hosted installation for on-premise clusters
  - Monitoring dashboards (Grafana/CloudWatch templates)
  - Operational runbooks for common scenarios

### Code Quality

- [ ] **Investigate and fix memory leak in journey tracking** (test/README.md)
  - Memory leak in `src/generator.js` journey tracking system
  - Blocks re-enabling certain tests
  - Related to vessel position generation

## Medium Priority

### Feature Enhancements

- [ ] **Multi-table rolling window support** (tools/maritime-data-synthesizer/cli.js)
  - Currently multi-table orchestrator only supports `initialize` command
  - Add `start` command for continuous generation with rolling window
  - Add `backfill` capability
  - Add `cleanup`/retention management
  - Reference: single-table MaritimeDataSynthesizer has working implementation

- [ ] **Dynamic Harper table creation via Operations API** (src/index.js)
  - Currently requires manual schema.graphql definition
  - Could dynamically create tables based on BigQuery schema at runtime
  - Enables automatic table creation from BigQuery metadata
  - Supports schema evolution without manual intervention
  - Reference: https://docs.harperdb.io/docs/developers/operations-api

- [ ] **Streaming insert API option for production** (docs/plans/)
  - Current implementation uses load job API (free tier compatible)
  - Add opt-in streaming insert for production deployments with benefits:
    - Lower latency for real-time use cases
    - Different cost model (may be preferred at scale)
  - Make it configurable per table

## Future (v3.0 Roadmap)

### Multi-Threaded Ingestion

- [ ] **Multiple worker threads per node**
  - Better CPU utilization on multi-core nodes
  - Code already supports durable thread identity via `hostname-workerIndex`

- [ ] **Thread-level checkpointing**
  - Fine-grained recovery per worker thread
  - Reduces restart recovery time

- [ ] **Automatic thread scaling**
  - Adjust worker count based on lag
  - Dynamic resource allocation

### Dynamic Rebalancing

- [ ] **Automatic rebalancing protocol**
  - Detect topology changes → pause → recalculate → resume
  - Currently requires stable cluster topology

- [ ] **Graceful node additions/removals**
  - No manual intervention required
  - Handle node changes without stopping sync

- [ ] **Zero-downtime scaling**
  - True autoscaling capability
  - Add/remove nodes on demand

### Monitoring & Observability

- [ ] **Cluster-wide health dashboard**
  - Aggregate metrics across all nodes
  - Visual representation of sync status

- [ ] **Enhanced monitoring endpoints**
  - Per-table metrics
  - Thread-level statistics
  - Lag histograms

- [ ] **Pre-built monitoring templates**
  - Grafana dashboards
  - CloudWatch/DataDog integrations
  - Alert configurations

## Nice to Have

### Testing & Quality

- [ ] **Comprehensive unit tests**
  - Core sync engine logic
  - Type conversion edge cases
  - Error handling paths

- [ ] **Integration test suite**
  - End-to-end sync validation
  - Multi-table scenarios
  - Failure recovery testing

- [ ] **Performance benchmarks**
  - Throughput measurements
  - Latency profiles
  - Resource usage baselines

### Documentation

- [ ] **Video tutorials**
  - Setup walkthrough
  - Configuration examples
  - Troubleshooting guide

- [ ] **Architecture diagrams**
  - System overview visuals
  - Data flow diagrams
  - Deployment topologies

- [ ] **More examples**
  - Additional use cases
  - Configuration patterns
  - Integration examples

### Developer Experience

- [ ] **Better CLI output**
  - Colorized status messages
  - Progress indicators
  - Formatted table output

- [ ] **Debug mode**
  - Verbose logging option
  - Request/response inspection
  - Performance profiling

- [ ] **Configuration validation**
  - Pre-flight config checks
  - Helpful error messages
  - Suggested fixes

## Completed ✅

- ✅ Multi-table support with column selection (v2.0)
- ✅ Maritime data synthesizer with realistic test data
- ✅ Modulo-based partitioning for distributed workload
- ✅ Adaptive batch sizing (phase-based)
- ✅ Checkpoint-based recovery per node
- ✅ Per-table validation and monitoring
- ✅ Backward compatibility with single-table format
- ✅ CI/CD with lint, test, format checks
- ✅ Project history documentation
- ✅ Reorganized codebase (src/ vs tools/)

---

**Last Updated:** 2025-11-13
