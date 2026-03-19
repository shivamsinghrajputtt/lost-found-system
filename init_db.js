const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = '<E7P2tkxj7P8BfA5V_CONNECTION_STRING_HERE>';

async function runSchema() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    await client.query(schemaSql);
    console.log('Schema executed successfully.');
  } catch (err) {
    console.error('Error executing schema:', err.message);
  } finally {
    await client.end();
  }
}

runSchema();
