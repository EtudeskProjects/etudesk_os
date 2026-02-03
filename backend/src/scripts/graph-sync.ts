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

import { logger } from '../utils';
async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args.find(a => a.startsWith('--batch'))?.split('=')[1] ?? '100');

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('            ETUDESK TALENT GRAPH SYNC');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('');

  try {
    // Initialize Neo4j
    logger.info('[1/3] Connecting to Neo4j...');
    await graphService.initialize();
    logger.info('      ✅ Connected to Neo4j');
    logger.info('');

    // Get current stats
    logger.info('[2/3] Current graph stats:');
    const statsBefore = await graphService.getStats();
    logger.info(`      Nodes: ${Object.values(statsBefore.nodes).reduce((a, b) => a + b, 0)}`);
    logger.info(`      Relationships: ${statsBefore.relationships.total}`);
    logger.info('');

    // Run sync
    logger.info('[3/3] Running full sync...');
    logger.info(`      Batch size: ${batchSize}`);
    logger.info('');

    const result = await postgresSyncService.runFullSync({ batchSize });

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('                     SYNC COMPLETE');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('');
    logger.info(`  Status: ${result.success ? '✅ SUCCESS' : '⚠️  COMPLETED WITH ERRORS'}`);
    logger.info(`  Nodes created/updated: ${result.nodesCreated}`);
    logger.info(`  Relationships created/updated: ${result.relationshipsCreated}`);
    logger.info(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (result.errors.length > 0) {
      logger.info('');
      logger.info('  Errors:');
      result.errors.forEach((err, i) => {
        logger.info(`    ${i + 1}. ${err}`);
      });
    }

    // Get final stats
    logger.info('');
    logger.info('  Final graph stats:');
    const statsAfter = await graphService.getStats();
    logger.info(`    Talents: ${statsAfter.nodes.talents}`);
    logger.info(`    Skills: ${statsAfter.nodes.skills}`);
    logger.info(`    Organizations: ${statsAfter.nodes.organizations}`);
    logger.info(`    Opportunities: ${statsAfter.nodes.opportunities}`);
    logger.info(`    Communities: ${statsAfter.nodes.communities}`);
    logger.info(`    Spaces: ${statsAfter.nodes.spaces}`);
    logger.info(`    Learning Topics: ${statsAfter.nodes.learningTopics}`);
    logger.info(`    Documents: ${statsAfter.nodes.documents}`);
    logger.info(`    Total Relationships: ${statsAfter.relationships.total}`);

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════════');

    await graphService.close();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('SYNC FAILED', error);
    process.exit(1);
  }
}

main();
