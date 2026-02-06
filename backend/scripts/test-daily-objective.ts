/**
 * Test script for Daily Objective Service
 * Run: npx ts-node scripts/test-daily-objective.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/services/database';
import { dailyObjectiveService } from '../src/services/daily-objective.service';

async function testDailyObjective() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('        DAILY OBJECTIVE SERVICE - AUDIT TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Check if migration has been run
    console.log('1️⃣  Checking database migration...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'daily_objectives'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table daily_objectives does not exist!');
      console.log('   Run migration: psql -d etudesk -f src/database/migrations/014_add_daily_objectives.sql');
      process.exit(1);
    }
    console.log('✅ Table daily_objectives exists\n');

    // 2. Get a real talent
    console.log('2️⃣  Fetching a real talent from database...');
    const talentResult = await pool.query(`
      SELECT t.id, t.first_name, t.last_name, t.sectors, t.goals,
             (SELECT COUNT(*) FROM opportunity_applications WHERE talent_id = t.id) as app_count,
             (SELECT COUNT(*) FROM community_members WHERE talent_id = t.id AND status = 'ACTIVE') as community_count
      FROM talents t
      WHERE t.first_name IS NOT NULL
      ORDER BY t.created_at DESC
      LIMIT 1
    `);

    if (talentResult.rows.length === 0) {
      console.log('❌ No talents found in database');
      process.exit(1);
    }

    const talent = talentResult.rows[0];
    console.log('✅ Found talent:');
    console.log(`   ID: ${talent.id}`);
    console.log(`   Name: ${talent.first_name} ${talent.last_name || ''}`);
    console.log(`   Sectors: ${talent.sectors?.join(', ') || 'None'}`);
    console.log(`   Goals: ${talent.goals?.join(', ') || 'None'}`);
    console.log(`   Applications: ${talent.app_count}`);
    console.log(`   Communities: ${talent.community_count}\n`);

    // 3. Test talent objective generation
    console.log('3️⃣  Generating talent daily objective...');
    const startTime = Date.now();
    const talentObjective = await dailyObjectiveService.getTalentDailyObjective(talent.id);
    const duration = Date.now() - startTime;

    console.log('✅ Talent Objective Generated:');
    console.log('─'.repeat(60));
    console.log(`   "${talentObjective.objective}"`);
    console.log('─'.repeat(60));
    console.log(`   Length: ${talentObjective.objective.length} chars`);
    console.log(`   Generated: ${talentObjective.generatedAt}`);
    console.log(`   Expires: ${talentObjective.expiresAt}`);
    console.log(`   Duration: ${duration}ms\n`);

    // 4. Test cache (should be instant)
    console.log('4️⃣  Testing cache (second call should be instant)...');
    const cacheStart = Date.now();
    const cachedObjective = await dailyObjectiveService.getTalentDailyObjective(talent.id);
    const cacheDuration = Date.now() - cacheStart;

    console.log(`✅ Cache hit: ${cacheDuration}ms`);
    console.log(`   Same objective: ${cachedObjective.objective === talentObjective.objective ? 'Yes ✓' : 'No ✗'}\n`);

    // 5. Get a real organization
    console.log('5️⃣  Fetching a real organization from database...');
    const orgResult = await pool.query(`
      SELECT o.id, o.name, o.types, o.sectors,
             (SELECT COUNT(*) FROM opportunities WHERE organization_id = o.id) as opp_count,
             (SELECT COUNT(*) FROM communities WHERE organization_id = o.id) as community_count,
             (SELECT COUNT(*) FROM spaces WHERE organization_id = o.id) as space_count
      FROM organizations o
      WHERE o.name IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 1
    `);

    if (orgResult.rows.length === 0) {
      console.log('⚠️  No organizations found, skipping org test\n');
    } else {
      const org = orgResult.rows[0];
      console.log('✅ Found organization:');
      console.log(`   ID: ${org.id}`);
      console.log(`   Name: ${org.name}`);
      console.log(`   Types: ${org.types?.join(', ') || 'None'}`);
      console.log(`   Opportunities: ${org.opp_count}`);
      console.log(`   Communities: ${org.community_count}`);
      console.log(`   Spaces: ${org.space_count}\n`);

      // 6. Test organization objective generation
      console.log('6️⃣  Generating organization daily objective...');
      const orgStart = Date.now();
      const orgObjective = await dailyObjectiveService.getOrganizationDailyObjective(org.id);
      const orgDuration = Date.now() - orgStart;

      console.log('✅ Organization Objective Generated:');
      console.log('─'.repeat(60));
      console.log(`   "${orgObjective.objective}"`);
      console.log('─'.repeat(60));
      console.log(`   Length: ${orgObjective.objective.length} chars`);
      console.log(`   Generated: ${orgObjective.generatedAt}`);
      console.log(`   Expires: ${orgObjective.expiresAt}`);
      console.log(`   Duration: ${orgDuration}ms\n`);
    }

    // 7. Show cached entries
    console.log('7️⃣  Current cache entries:');
    const cacheEntries = await pool.query(`
      SELECT
        CASE WHEN talent_id IS NOT NULL THEN 'TALENT' ELSE 'ORG' END as type,
        COALESCE(talent_id::text, organization_id::text) as entity_id,
        LEFT(objective, 50) || '...' as objective_preview,
        generated_at,
        expires_at
      FROM daily_objectives
      ORDER BY generated_at DESC
      LIMIT 5
    `);

    if (cacheEntries.rows.length > 0) {
      console.table(cacheEntries.rows);
    } else {
      console.log('   No cache entries found\n');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                    AUDIT COMPLETE ✓');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error during test:', error);
  } finally {
    await pool.end();
  }
}

testDailyObjective();
