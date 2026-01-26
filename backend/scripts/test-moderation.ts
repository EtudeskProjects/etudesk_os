
import dotenv from 'dotenv';
import path from 'path';
import { autoModerationService } from '../src/services/auto-moderation.service';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

const runTest = async () => {
    console.log('🧪 Testing Auto-Moderation with OpenAI API...\n');

    const testCases = [
        {
            name: 'Safe Content',
            content: 'Bonjour, je suis heureux de rejoindre cette communauté !'
        },
        {
            name: 'Toxic Content (Hate/Violence)',
            content: 'I want to kill them all and destroy everything. They are disgusting.'
        },
        {
            name: 'Borderline (Strong Language)',
            content: 'This code is damn stupid but I love it.'
        }
    ];

    for (const test of testCases) {
        console.log(`📝 Testing: ${test.name}`);
        console.log(`   Input: "${test.content}"`);
        const start = Date.now();
        const result = await autoModerationService.screenContent(test.content);
        const duration = Date.now() - start;
        console.log(`   Result: [${result.status}] ${result.reason || ''}`);
        console.log(`   Time: ${duration}ms`);
        console.log('---------------------------------------------------');
    }
};

runTest();
