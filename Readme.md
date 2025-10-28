# BigQuery Sync Component for Harper

Distributed data ingestion from Google BigQuery to Harper using modulo-based partitioning.

**About Harper:** Harper is a distributed application platform that unifies database, cache, and application server. [Learn more](https://harperdb.io)

**Quick Start:** Deploy this component on [Harper Fabric](https://fabric.harper.fast) - no credit card required, free tier available.

## Features

- **Horizontal Scalability**: Linear throughput increase with cluster size
- **No Coordination**: Each node independently determines its workload
- **Failure Recovery**: Local checkpoints enable independent node recovery
- **Adaptive Polling**: Batch sizes adjust based on sync lag
- **Continuous Validation**: Automatic data completeness checks
- **Native Replication**: Leverages Harper's clustering for data distribution ([docs](https://docs.harperdb.io/docs/developers/replication))

## Architecture

Each node:
1. Discovers cluster topology via Harper's clustering API
2. Calculates its node ID from ordered peer list
3. Pulls only records where `hash(timestamp) % clusterSize == nodeId`
4. Writes to local Harper instance
5. Relies on Harper's native replication

## Installation

### Option 1: Deploy on Fabric (Recommended)
1. Sign up at [fabric.harper.fast](https://fabric.harper.fast)
2. Create a new application
3. Upload this component
4. Configure BigQuery credentials
5. Component auto-deploys across your cluster

### Option 2: Self-Hosted
1. Deploy Harper cluster (3+ nodes recommended) - [Quick start guide](https://docs.harperdb.io/docs/getting-started/quickstart)
2. Configure clustering between nodes - [Clustering docs](https://docs.harperdb.io/docs/developers/replication)
3. Copy this component to each node:
   ```bash
   harper deploy bigquery-sync /path/to/component
   ```

4. Configure `config.yaml` with BigQuery credentials:
   ```yaml
   bigquery:
     projectId: your-project
     dataset: your_dataset
     table: your_table
     credentials: /path/to/service-account.json
   ```

## Configuration

### BigQuery Setup

Ensure service account has:
- `bigquery.jobs.create` permission
- `bigquery.tables.getData` permission on target table

[BigQuery IAM documentation](https://cloud.google.com/bigquery/docs/access-control)

### Harper Setup

Each node needs:
- Fixed node ID (recommended for production)
- Clustering configured with peer discovery ([learn more](https://docs.harperdb.io/docs/developers/replication))
- Sufficient IOPS for write throughput

**Fabric users:** Clustering is automatic - no manual configuration needed.

### Batch Size Tuning

Adjust based on:
- Record size
- Network bandwidth
- IOPS capacity
- Desired latency

## Monitoring

### Check Sync Status
```javascript
// Query checkpoint table
SELECT * FROM SyncCheckpoint ORDER BY nodeId;
```

### View Recent Audits
```javascript
// Check validation results
SELECT * FROM SyncAudit 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

### Monitor Lag
```javascript
// Calculate current lag
SELECT 
  nodeId, 
  lastTimestamp,
  (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(lastTimestamp)) as lag_seconds,
  phase
FROM SyncCheckpoint;
```

## API Endpoints

### Get Status
```bash
GET /SyncControl
```

Returns current sync status for the node.

### Control Sync
```bash
POST /SyncControl
{
  "action": "start" | "stop" | "validate"
}
```

## Troubleshooting

### Node Not Ingesting
- Check BigQuery credentials
- Verify node can reach BigQuery API
- Check checkpoint table for errors

### Data Drift Detected
- Run manual validation
- Check for partition key collisions
- Verify all nodes are running

### High Lag
- Increase batch sizes
- Add more nodes
- Check IOPS capacity

**Need help?** Visit [Harper documentation](https://docs.harperdb.io) or reach out to our team at [harperdb.io](https://harperdb.io)

## Performance Tuning

### IOPS Calculation
```
Indexes: 1 primary + 1 timestamp = 2 indexes
IOPS per record: ~4 IOPS
Target throughput: 5000 records/sec per node
Required IOPS: 20,000 per node
```

Learn more about [Harper's storage architecture](https://docs.harperdb.io/docs/reference/storage-algorithm)

### Scaling Guidelines
- 3 nodes: ~15K records/sec total
- 6 nodes: ~30K records/sec total
- 12 nodes: ~60K records/sec total

**Fabric scaling:** Add nodes with one click - automatic rebalancing and cluster configuration.

## Limitations

- Cluster size should remain stable (node additions require rebalancing)
- BigQuery costs increase with query frequency
- Modulo partitioning requires hashable timestamp

## Future Enhancements

- Dynamic rebalancing on topology changes
- Push-based sync via BigQuery Pub/Sub
- Data transformation pipeline (raw → cooked tables)

---

**Get Started:** Deploy on [Harper Fabric](https://fabric.harper.fast) - free tier available, no credit card required.

**Learn More:** [Harper Documentation](https://docs.harperdb.io) | [harperdb.io](https://harperdb.io)