import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'irjudson-demo',
  keyFilename: 'service-account-key.json',
  location: 'US'
});

async function checkData() {
  console.log('Checking vessel_positions data range...\n');
  
  const query = `
    SELECT 
      COUNT(*) as total_records,
      MIN(timestamp) as oldest_timestamp,
      MAX(timestamp) as newest_timestamp,
      TIMESTAMP_DIFF(MAX(timestamp), MIN(timestamp), HOUR) as hours_span
    FROM \`irjudson-demo.maritime_tracking.vessel_positions\`
  `;
  
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log('Results:', JSON.stringify(rows[0], null, 2));
  
  // Now test the MOD partitioning for node 0
  console.log('\n\nChecking MOD partitioning for node 0 (clusterSize=6)...\n');
  
  const partitionQuery = `
    SELECT 
      COUNT(*) as records_for_node_0,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM \`irjudson-demo.maritime_tracking.vessel_positions\`
    WHERE MOD(UNIX_MICROS(timestamp), 6) = 0
  `;
  
  const [partRows] = await bigquery.query({ query: partitionQuery, location: 'US' });
  console.log('Node 0 partition:', JSON.stringify(partRows[0], null, 2));
  
  // Test the actual query being used
  console.log('\n\nTesting actual sync query (node 0, lastTimestamp=1970-01-01)...\n');
  
  const syncQuery = `
    SELECT COUNT(*) as matching_records
    FROM \`irjudson-demo.maritime_tracking.vessel_positions\`
    WHERE
      CAST(6 AS INT64) > 0
      AND CAST(0 AS INT64) BETWEEN 0 AND CAST(6 AS INT64) - 1
      AND MOD(UNIX_MICROS(timestamp), CAST(6 AS INT64)) = CAST(0 AS INT64)
      AND timestamp > TIMESTAMP('1970-01-01T00:00:00Z')
  `;
  
  const [syncRows] = await bigquery.query({ query: syncQuery, location: 'US' });
  console.log('Sync query matches:', JSON.stringify(syncRows[0], null, 2));
}

checkData().catch(console.error);
