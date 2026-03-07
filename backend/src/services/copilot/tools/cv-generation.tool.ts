import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { defineTool, ToolDefinition } from './tool-helper';
import { getAnthropicClient } from '../../ai/provider';
import { createSqlQueryTool } from './sql-query.tool';
import { createFileReaderTool } from './file-read.tool';
import { createGenerateDocumentTool } from './generate-document.tool';
import { logger } from '../../../utils';
import { MODEL_AGENT } from '../../ai/models';
import { i18next } from '../../../i18n';
import { toTOON } from '../../ai/toon';

const CV_CONTENT_CONTRACT = {
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'email',
  phone: 'phone',
  city: 'Dakar',
  country: 'Senegal',
  bio: 'Résumé professionnel.',
  skills: [{ name: 'Compétence', type: 'hard', level: 'expert' }],
  languages: [{ language: 'Français', level: 'native' }],
  interests: ['Interet 1'],
  goals: ['Objectif 1'],
  experiences: [{ title: 'Poste', company: 'Entreprise', location: 'Ville', period: '2022-Present', description: 'Desc' }],
  education: [{ degree: 'Diplôme', institution: 'Ecole', location: 'Ville', period: '2020', description: 'Desc' }],
  certifications: [{ name: 'Certif', issuer: 'Org', date: '2023' }],
};

const CV_GENERATION_INSTRUCTIONS = `
# CV Generation Workflow

You are the CV Generation sub-agent. Follow these steps precisely to produce an elegant, professionally designed PDF CV.

## Step 1: Gather Context
1. Call \`sql_query(my_profile)\` to get profile data (name, email, phone, city, country, bio, skills, goals).
2. Call \`sql_query(my_documents)\` to find any existing CV documents.
3. If an existing CV is found, call \`file_reader\` with its documentId to read the content for merging.

## Step 2: Read Existing CV (if any)
4. If \`file_reader\` returned CV content, extract experiences, education, certifications, and languages to include in the new one.
5. If no existing CV, rely on profile data only.

## Step 3: Generate the CV (PDF by default)
6. Call \`generate_document\` with format "PDF" and the **CV canonical object format** for contentJson. 

**CRITICAL: Use the CV canonical object format (NOT the sections format) for CV generation.**

Pass \`contentJson\` as an object (or JSON string) with this structure:
${toTOON(CV_CONTENT_CONTRACT)}

## Output rule
Return a professional summary of what you did and include the entity block for the generated document like this:
\`\`\`entity:document
{"id":"DOCUMENT_ID"}
\`\`\`
`;

/**
 * Executes the CV Generation sub-agent via Claude.
 */
export function createCvGenerationTool(talentId: string, avatarUrl?: string, language?: string): ToolDefinition {
    return defineTool({
        name: 'generate_cv',
        description: 'Generates or updates a professional CV for the talent. Call this tool when the user asks to create, generate, or update their CV.',
        parameters: z.object({
            request: z.string().describe('The specific user request regarding their CV'),
        }),
        execute: async ({ request }) => {
            const CV_TIMEOUT_MS = 30_000;
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), CV_TIMEOUT_MS);

            try {
                const anthropic = getAnthropicClient();

                const sqlTool = createSqlQueryTool(talentId, undefined, undefined, language);
                const fileReaderTool = createFileReaderTool(talentId);
                const genDocTool = createGenerateDocumentTool(talentId, avatarUrl, undefined, language);

                const availableTools = [sqlTool, fileReaderTool, genDocTool];
                const tDefs = availableTools.map((t) => t.definition);

                logger.info(`[cv_generation] Launching CV sub-agent for talent ${talentId}`);

                const messages: Anthropic.MessageParam[] = [
                    { role: 'user', content: request },
                ];

                // Multi-turn loop (max 5 iterations)
                for (let i = 0; i < 5; i++) {
                    const response = await anthropic.messages.create(
                        {
                            model: MODEL_AGENT || 'claude-3-5-sonnet-20241022',
                            system: CV_GENERATION_INSTRUCTIONS,
                            max_tokens: 2000,
                            messages,
                            tools: tDefs,
                        },
                        { signal: abortController.signal },
                    );

                    // push assistant reply
                    messages.push({
                        role: 'assistant',
                        content: response.content,
                    });

                    if (response.stop_reason === 'tool_use') {
                        const toolResults: Anthropic.ToolResultBlockParam[] = [];
                        for (const block of response.content) {
                            if (block.type === 'tool_use') {
                                const toolDef = availableTools.find((t) => t.definition.name === block.name);
                                if (toolDef) {
                                    const result = await toolDef.execute(block.input);
                                    toolResults.push({
                                        type: 'tool_result',
                                        tool_use_id: block.id,
                                        content: typeof result === 'string' ? result : JSON.stringify(result),
                                    });
                                } else {
                                    toolResults.push({
                                        type: 'tool_result',
                                        tool_use_id: block.id,
                                        content: JSON.stringify({ error: i18next.t('copilot:toolNotAvailable', { lng: language, tool: block.name }) }),
                                        is_error: true,
                                    });
                                }
                            }
                        }
                        messages.push({ role: 'user', content: toolResults });
                    } else {
                        // Processing done
                        const textContent = response.content.find((b) => b.type === 'text');
                        return {
                            success: true,
                            content: textContent && 'text' in textContent ? textContent.text : 'CV generated successfully',
                        };
                    }
                }

                return { success: false, error: i18next.t('copilot:toolSubAgentMaxIterations', { lng: language }) };
            } catch (error: any) {
                if (error.name === 'AbortError' || abortController.signal.aborted) {
                    logger.warn(`[cv_generation] Timeout after ${CV_TIMEOUT_MS}ms for talent ${talentId}`);
                    return { success: false, error: i18next.t('copilot:toolCvTimeout', { lng: language }) };
                }
                logger.error(`[cv_generation] Fatal error: ${error.message}`);
                return { success: false, error: error.message };
            } finally {
                clearTimeout(timeoutId);
            }
        },
    });
}
