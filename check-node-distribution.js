import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'irjudson-demo',
  keyFilename: 'service-account-key.json',
  location: 'US'
});

async function checkDistribution() {
  console.log('Checking vessel_positions distribution across all 6 nodes...\n');
  
  for (let nodeId = 0; nodeId < 6; nodeId++) {
    const query = `
      SELECT COUNT(*) as count
      FROM \`irjudson-demo.maritime_tracking.vessel_positions\`
      WHERE MOD(UNIX_MICROS(timestamp), 6) = ${nodeId}
        AND timestamp > TIMESTAMP('1970-01-01T00:00:00Z')
    `;
    
    const [rows] = await bigquery.query({ query, location: 'US' });
    console.log(`Node ${nodeId}: ${rows[0].count} records`);
  }
  
  console.log('\n\nChecking port_events distribution...\n');
  
  for (let nodeId = 0; nodeId < 6; nodeId++) {
    const query = `
      SELECT COUNT(*) as count
      FROM \`irjudson-demo.maritime_tracking.port_events\`
      WHERE MOD(UNIX_MICROS(event_time), 6) = ${nodeId}
        AND event_time > TIMESTAMP('1970-01-01T00:00:00Z')
    `;
    
    const [rows] = await bigquery.query({ query, location: 'US' });
    console.log(`Node ${nodeId}: ${rows[0].count} records`);
  }
  
  console.log('\n\nChecking vessel_metadata distribution...\n');
  
  for (let nodeId = 0; nodeId < 6; nodeId++) {
    const query = `
      SELECT COUNT(*) as count
      FROM \`irjudson-demo.maritime_tracking.vessel_metadata\`
      WHERE MOD(UNIX_MICROS(last_updated), 6) = ${nodeId}
        AND last_updated > TIMESTAMP('1970-01-01T00:00:00Z')
    `;
    
    const [rows] = await bigquery.query({ query, location: 'US' });
    console.log(`Node ${nodeId}: ${rows[0].count} records`);
  }
}

checkDistribution().catch(console.error);
