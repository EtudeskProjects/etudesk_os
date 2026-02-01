/**
 * Graph Sync Script
 *
 * Synchronizes data from PostgreSQL to Neo4j Talent Graph
 *
 * Usage:
 *   npm run graph:sync
 *   npm run graph:sync -- --full     # Full sync (default)
 *   npm run graph:sync -- --batch 50 # Custom batch size
 */

import dotenv from 'dotenv';
dotenv.config();

import { graphService, postgresSyncService } from '../services/graph';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args.find(a => a.startsWith('--batch'))?.split('=')[1] ?? '100');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('            ETUDESK TALENT GRAPH SYNC');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Initialize Neo4j
    console.log('[1/3] Connecting to Neo4j...');
    await graphService.initialize();
    console.log('      ✅ Connected to Neo4j');
    console.log('');

    // Get current stats
    console.log('[2/3] Current graph stats:');
    const statsBefore = await graphService.getStats();
    console.log(`      Nodes: ${Object.values(statsBefore.nodes).reduce((a, b) => a + b, 0)}`);
    console.log(`      Relationships: ${statsBefore.relationships.total}`);
    console.log('');

    // Run sync
    console.log('[3/3] Running full sync...');
    console.log(`      Batch size: ${batchSize}`);
    console.log('');

    const result = await postgresSyncService.runFullSync({ batchSize });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                     SYNC COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Status: ${result.success ? '✅ SUCCESS' : '⚠️  COMPLETED WITH ERRORS'}`);
    console.log(`  Nodes created/updated: ${result.nodesCreated}`);
    console.log(`  Relationships created/updated: ${result.relationshipsCreated}`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (result.errors.length > 0) {
      console.log('');
      console.log('  Errors:');
      result.errors.forEach((err, i) => {
        console.log(`    ${i + 1}. ${err}`);
      });
    }

    // Get final stats
    console.log('');
    console.log('  Final graph stats:');
    const statsAfter = await graphService.getStats();
    console.log(`    Talents: ${statsAfter.nodes.talents}`);
    console.log(`    Skills: ${statsAfter.nodes.skills}`);
    console.log(`    Organizations: ${statsAfter.nodes.organizations}`);
    console.log(`    Opportunities: ${statsAfter.nodes.opportunities}`);
    console.log(`    Communities: ${statsAfter.nodes.communities}`);
    console.log(`    Spaces: ${statsAfter.nodes.spaces}`);
    console.log(`    Learning Topics: ${statsAfter.nodes.learningTopics}`);
    console.log(`    Documents: ${statsAfter.nodes.documents}`);
    console.log(`    Total Relationships: ${statsAfter.relationships.total}`);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    await graphService.close();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('❌ SYNC FAILED');
    console.error(error);
    process.exit(1);
  }
}

main();
