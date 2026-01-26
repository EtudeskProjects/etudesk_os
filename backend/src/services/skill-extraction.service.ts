/**
 * Skill Extraction Service (Simplified)
 * Basic skill extraction from documents using GPT-5 nano
 */

import OpenAI from 'openai';
import { pool } from './database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = 'gpt-4.1-nano';

interface ExtractedSkill {
  name: string;
  relevance: number;
}

/**
 * Extract basic skills from document text
 */
async function extractSkillsFromText(text: string): Promise<ExtractedSkill[]> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en extraction de compétences. Réponds toujours en JSON valide.',
        },
        {
          role: 'user',
          content: `Extrais les compétences de ce document. Réponds UNIQUEMENT en JSON: {"skills": [{"name": "...", "relevance": 0.9}]}

Document:
${text.slice(0, 10000)}`,
        },
      ],
      max_completion_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const resultText = response.choices[0]?.message?.content;
    if (resultText) {
      const parsed = JSON.parse(resultText);
      return parsed.skills || [];
    }
  } catch (error) {
    console.error('Error extracting skills:', error);
  }
  return [];
}

/**
 * Process document and extract skills
 */
export async function processDocumentSkills(documentId: string): Promise<{
  success: boolean;
  skillsExtracted: number;
  skillsCreated: number;
  message: string;
}> {
  try {
    const docResult = await pool.query(`
      SELECT id, talent_id, type, extracted_text
      FROM documents WHERE id = $1 AND deleted_at IS NULL
    `, [documentId]);

    if (docResult.rows.length === 0) {
      return { success: false, skillsExtracted: 0, skillsCreated: 0, message: 'Document not found' };
    }

    const document = docResult.rows[0];
    if (!document.extracted_text) {
      return { success: false, skillsExtracted: 0, skillsCreated: 0, message: 'No text content' };
    }

    const skills = await extractSkillsFromText(document.extracted_text);

    // Save skills
    await pool.query(`DELETE FROM document_skills WHERE document_id = $1`, [documentId]);

    for (const skill of skills) {
      // Find or create skill
      let skillId: string | null = null;
      const existingSkill = await pool.query(
        `SELECT id FROM skills WHERE LOWER(canonical_name) = LOWER($1)`,
        [skill.name]
      );

      if (existingSkill.rows.length > 0) {
        skillId = existingSkill.rows[0].id;
      } else {
        const newSkill = await pool.query(
          `INSERT INTO skills (canonical_name, type, is_verified) VALUES ($1, 'HARD_SKILL', FALSE) RETURNING id`,
          [skill.name]
        );
        skillId = newSkill.rows[0].id;
      }

      await pool.query(`
        INSERT INTO document_skills (document_id, skill_id, skill_name, relevance_score, is_auto_generated)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (document_id, skill_name) DO UPDATE SET relevance_score = EXCLUDED.relevance_score
      `, [documentId, skillId, skill.name, skill.relevance]);

      // Add to talent skills
      await pool.query(`
        INSERT INTO talent_skills (talent_id, skill_id, proficiency_level, self_assessed)
        VALUES ($1, $2, 'B', FALSE)
        ON CONFLICT (talent_id, skill_id) DO NOTHING
      `, [document.talent_id, skillId]);
    }

    await pool.query(`
      UPDATE documents SET skills_extracted = TRUE, skills_extracted_at = NOW() WHERE id = $1
    `, [documentId]);

    return { success: true, skillsExtracted: skills.length, skillsCreated: 0, message: 'OK' };
  } catch (error) {
    console.error('Error processing document skills:', error);
    return { success: false, skillsExtracted: 0, skillsCreated: 0, message: 'Error' };
  }
}

/**
 * Queue document for skill extraction
 */
export function queueDocumentForExtraction(documentId: string): void {
  setTimeout(async () => {
    try {
      await processDocumentSkills(documentId);
    } catch (error) {
      console.error(`Failed to extract skills for document ${documentId}:`, error);
    }
  }, 100);
}
