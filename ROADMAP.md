# Project Roadmap

## 🎉 v2.0 Complete - Multi-Table Production Release

We've shipped v2.0 with comprehensive multi-table support, column selection, and production-ready features. The plugin is ready for large-scale deployments.

## What's Shipped (v2.0) ✅

### Core Plugin Features

- ✅ **Multi-table support** - Sync multiple BigQuery tables simultaneously with independent settings
- ✅ **Column selection** - Reduce costs by fetching only needed columns from BigQuery
- ✅ **Per-table configuration** - Independent batch sizes, sync intervals, and strategies per table
- ✅ **Exponential backoff retry logic** - Smart retry with jitter for transient BigQuery errors ([#3](https://github.com/HarperFast/bigquery-ingestor/issues/3))
- ✅ **Comprehensive logging** - Structured logging throughout codebase for Grafana observability ([#11](https://github.com/HarperFast/bigquery-ingestor/issues/11))
- ✅ **Optional streaming insert API** - Configurable streaming inserts for production deployments ([#8](https://github.com/HarperFast/bigquery-ingestor/issues/8))
- ✅ **Multi-table validation** - Independent validation and monitoring per table
- ✅ **Backward compatibility** - Single-table format still supported

### Distributed Architecture

- ✅ **Modulo-based partitioning** - Deterministic distributed workload assignment
- ✅ **Adaptive batch sizing** - Phase-based adjustment (initial/catchup/steady)
- ✅ **Checkpoint-based recovery** - Independent per-node failure recovery
- ✅ **Horizontal scalability** - Linear throughput increase with cluster size

### Maritime Data Synthesizer

- ✅ **Multi-table orchestrator** - Generate realistic data for multiple related tables ([#6](https://github.com/HarperFast/bigquery-ingestor/issues/6))
- ✅ **Rolling window mode** - Automatic data window maintenance and backfill
- ✅ **100K+ vessel simulation** - Realistic maritime tracking data at global scale
- ✅ **Physics-based movement** - Realistic navigation patterns
- ✅ **Automatic retention** - Configurable rolling window with cleanup

### Project Quality

- ✅ **Memory leak fixes** - Journey tracking system optimized ([#5](https://github.com/HarperFast/bigquery-ingestor/issues/5))
- ✅ **CI/CD pipeline** - Automated lint, test, and format checks
- ✅ **Comprehensive documentation** - User guides, API docs, design documents
- ✅ **Project history** - Development milestones and evolution tracking
- ✅ **Reorganized codebase** - Clear separation (src/ vs tools/)

## What's Next (v3.0 Vision)

### Multi-Threaded Ingestion

- [ ] **Multi-threaded ingestion per node** ([#9](https://github.com/HarperFast/bigquery-ingestor/issues/9))
  - Better CPU utilization on multi-core nodes
  - Code already supports durable thread identity via `hostname-workerIndex`
  - Thread-level checkpointing for fine-grained recovery
  - Automatic thread scaling based on lag

### Dynamic Rebalancing

- [ ] **Dynamic rebalancing for autoscaling** ([#10](https://github.com/HarperFast/bigquery-ingestor/issues/10))
  - Detect topology changes → pause → recalculate → resume
  - Graceful node additions/removals without manual intervention
  - Zero-downtime scaling capabilities
  - Currently requires stable cluster topology

### Enhanced Monitoring

- [ ] **Cluster-wide health dashboard**
  - Per-table metrics and thread-level statistics
  - Lag histograms and performance profiles
  - Pre-built Grafana dashboards
  - CloudWatch/DataDog integrations
  - Alert configurations

### Dynamic Schema Management

- [ ] **Dynamic Harper table creation via Operations API** ([#7](https://github.com/HarperFast/bigquery-ingestor/issues/7))
  - Currently requires manual schema.graphql definition
  - Could dynamically create tables based on BigQuery schema at runtime
  - Enables automatic table creation from BigQuery metadata
  - Supports schema evolution without manual intervention
  - Reference: https://docs.harperdb.io/docs/developers/operations-api

## Future Considerations

These are potential enhancements without specific commitments:

### Production Operations

- [ ] **Production deployment documentation** ([#4](https://github.com/HarperFast/bigquery-ingestor/issues/4))
  - Fabric deployment guide with one-click setup
  - Self-hosted installation for on-premise clusters
  - Monitoring dashboards (Grafana/CloudWatch templates)
  - Operational runbooks for common scenarios

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

## How to Contribute

Want to help build v3.0 or tackle future considerations? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Check out [open issues on GitHub](https://github.com/HarperFast/bigquery-ingestor/issues) for specific tasks you can pick up.

---

**Last Updated:** 2025-12-15
