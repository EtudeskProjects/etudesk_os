/**
 * KYC Verification Service
 * Uses OpenAI gpt-5-mini vision for document verification
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { MODEL_SEARCH } from './ai/models';
import { getOpenAIClient } from './ai/provider';
import { buildKYCVerificationPrompt, buildQuickCheckPrompt, KYC_SYSTEM_PROMPT } from './ai/prompts/kyc.prompt';
import { buildTalentObject } from './ai/talent-object';

import { logger } from '../utils';

export type DocumentType = 'ID_CARD' | 'PASSPORT' | 'DRIVER_LICENSE' | 'STUDENT_CARD';

export interface TalentProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string; // computed: COALESCE(first_name || ' ' || last_name, email)
}

export interface DocumentAnalysis {
  detected_document_type: DocumentType | 'UNKNOWN' | 'INVALID';
  document_type_confidence: number; // 0-100
  is_valid_document: boolean;
  document_quality: 'GOOD' | 'ACCEPTABLE' | 'POOR';
  extracted_info: {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    document_number: string | null;
    expiry_date: string | null;
    country: string | null;
  };
  front_analysis: {
    is_front_side: boolean;
    has_photo: boolean;
    is_readable: boolean;
    issues: string[];
  };
  back_analysis?: {
    is_back_side: boolean;
    is_readable: boolean;
    issues: string[];
  };
}

export interface VerificationResult {
  success: boolean;
  is_verified: boolean;
  verification_score: number; // 0-100
  document_analysis: DocumentAnalysis;
  profile_match: {
    names_match: boolean;
    match_confidence: number; // 0-100
    extracted_name: string | null;
    profile_name: string | null;
    mismatch_details?: string;
  };
  rejection_reasons: string[];
  warnings: string[];
  error?: string;
}

// --- Json Schema For Structured Output ---

const DOCUMENT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    detected_document_type: {
      type: 'string',
      enum: ['ID_CARD', 'PASSPORT', 'DRIVER_LICENSE', 'STUDENT_CARD', 'UNKNOWN', 'INVALID'],
    },
    document_type_confidence: { type: 'number' },
    is_valid_document: { type: 'boolean' },
    document_quality: { type: 'string', enum: ['GOOD', 'ACCEPTABLE', 'POOR'] },
    extracted_first_name: { type: 'string', nullable: true },
    extracted_last_name: { type: 'string', nullable: true },
    extracted_full_name: { type: 'string', nullable: true },
    document_number: { type: 'string', nullable: true },
    expiry_date: { type: 'string', nullable: true },
    country: { type: 'string', nullable: true },
    is_front_side: { type: 'boolean' },
    has_photo: { type: 'boolean' },
    is_readable: { type: 'boolean' },
    front_issues: { type: 'array', items: { type: 'string' } },
    is_back_side: { type: 'boolean', nullable: true },
    back_is_readable: { type: 'boolean', nullable: true },
    back_issues: { type: 'array', items: { type: 'string' }, nullable: true },
  },
  required: [
    'detected_document_type', 'document_type_confidence', 'is_valid_document',
    'document_quality', 'is_front_side', 'has_photo', 'is_readable', 'front_issues',
  ],
};

// --- Helper Functions ---

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

async function imageToBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    if (imageUrl.startsWith('/uploads/')) {
      const relativePath = imageUrl.replace('/uploads/', '');
      const filePath = path.join(UPLOAD_BASE_DIR, relativePath);

      if (!fs.existsSync(filePath)) {
        logger.error(`KYC image file not found: ${filePath}`);
        return null;
      }

      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' :
                       ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { data: buffer.toString('base64'), mimeType };
    }

    if (imageUrl.startsWith('/') || imageUrl.startsWith('file://')) {
      const filePath = imageUrl.replace('file://', '');
      if (!fs.existsSync(filePath)) {
        logger.error(`Image file not found: ${filePath}`);
        return null;
      }
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' :
                       ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { data: buffer.toString('base64'), mimeType };
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { data: buffer.toString('base64'), mimeType: contentType };
    }

    if (imageUrl.startsWith('data:')) {
      const [header, data] = imageUrl.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      return { data, mimeType };
    }

    return { data: imageUrl, mimeType: 'image/jpeg' };
  } catch (error) {
    logger.error('Error converting image to base64:', error);
    return null;
  }
}

function normalizeName(name: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function compareNames(name1: string | null, name2: string | null): { match: boolean; confidence: number } {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (!n1 || !n2) return { match: false, confidence: 0 };
  if (n1 === n2) return { match: true, confidence: 100 };
  if (n1.includes(n2) || n2.includes(n1)) return { match: true, confidence: 85 };

  const parts1 = n1.split(' ');
  const parts2 = n2.split(' ');
  let matchingParts = 0;
  for (const part1 of parts1) {
    for (const part2 of parts2) {
      if (part1 === part2 && part1.length > 2) matchingParts++;
    }
  }

  if (matchingParts >= 2) return { match: true, confidence: 80 };
  if (matchingParts === 1) return { match: true, confidence: 60 };

  const maxLen = Math.max(n1.length, n2.length);
  const distance = levenshteinDistance(n1, n2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return { match: similarity >= 70, confidence: Math.round(similarity) };
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// --- Error Result Helper ---

function errorResult(
  issues: string[],
  rejectionReasons: string[],
  profileName: string | null,
  error?: string
): VerificationResult {
  return {
    success: !error,
    is_verified: false,
    verification_score: 0,
    document_analysis: {
      detected_document_type: 'UNKNOWN',
      document_type_confidence: 0,
      is_valid_document: false,
      document_quality: 'POOR',
      extracted_info: {
        first_name: null, last_name: null, full_name: null,
        document_number: null, expiry_date: null, country: null,
      },
      front_analysis: {
        is_front_side: false, has_photo: false, is_readable: false, issues,
      },
    },
    profile_match: {
      names_match: false, match_confidence: 0,
      extracted_name: null, profile_name: profileName,
    },
    rejection_reasons: rejectionReasons,
    warnings: [],
    error,
  };
}

// --- Main Verification Function ---

export async function verifyKYCDocument(
  talentId: string,
  expectedDocType: DocumentType,
  frontImageUrl: string,
  backImageUrl?: string
): Promise<VerificationResult> {
  logger.info(`Starting KYC verification for talent ${talentId}`);

  if (!process.env.OPENAI_API_KEY) {
    return errorResult(
      ['Service de vérification non configuré'],
      ['Service de vérification non disponible'],
      null,
      'OPENAI_API_KEY not configured'
    );
  }

  const talentObj = await buildTalentObject(talentId, true);
  if (!talentObj) {
    return errorResult(
      ['Profil non trouvé'],
      ['Profil utilisateur non trouvé'],
      null,
      'Talent profile not found'
    );
  }

  const talent: TalentProfile = {
    id: talentObj.id,
    first_name: talentObj.first_name,
    last_name: talentObj.last_name,
    display_name: talentObj.display_name,
  };

  const frontImage = await imageToBase64(frontImageUrl);
  if (!frontImage) {
    return errorResult(
      ['Impossible de charger l\'image recto'],
      ['Image recto non accessible'],
      talent.display_name,
      'Failed to load front image'
    );
  }

  const backImage = backImageUrl ? await imageToBase64(backImageUrl) : null;

  const docTypeLabels: Record<DocumentType, string> = {
    'ID_CARD': 'Carte d\'identité nationale',
    'PASSPORT': 'Passeport',
    'DRIVER_LICENSE': 'Permis de conduire',
    'STUDENT_CARD': 'Carte scolaire / étudiante',
  };

  const profileName = [talentObj.first_name, talentObj.last_name].filter(Boolean).join(' ') || talentObj.display_name;
  const talentContext = `Nom: ${profileName}\nPays: ${talentObj.country || 'Non renseigné'}`;

  const prompt = buildKYCVerificationPrompt(
    expectedDocType,
    docTypeLabels[expectedDocType],
    !!backImage,
    JSON.stringify(DOCUMENT_ANALYSIS_SCHEMA, null, 2),
    talentContext
  );

  // Build messages with vision
  const imageContent: OpenAI.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: `data:${frontImage.mimeType};base64,${frontImage.data}`, detail: 'high' },
    },
  ];

  if (backImage) {
    imageContent.push({
      type: 'image_url',
      image_url: { url: `data:${backImage.mimeType};base64,${backImage.data}`, detail: 'high' },
    });
  }

  try {
    logger.info(`Calling gpt-5-mini API for document analysis...`);

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: MODEL_SEARCH,
      messages: [
        { role: 'system', content: KYC_SYSTEM_PROMPT },
        { role: 'user', content: imageContent },
      ],
    });

    const analysisText = completion.choices[0]?.message?.content?.trim();
    if (!analysisText) {
      throw new Error('Empty response from API');
    }

    logger.info('gpt-5-mini raw response', { response: analysisText });

    interface DocumentAnalysisResponse {
      detected_document_type: DocumentType | 'UNKNOWN' | 'INVALID';
      document_type_confidence: number;
      is_valid_document: boolean;
      document_quality: 'GOOD' | 'ACCEPTABLE' | 'POOR';
      extracted_first_name?: string | null;
      extracted_last_name?: string | null;
      extracted_full_name?: string | null;
      document_number?: string | null;
      expiry_date?: string | null;
      country?: string | null;
      is_front_side: boolean;
      has_photo: boolean;
      is_readable: boolean;
      front_issues: string[];
      is_back_side?: boolean | null;
      back_is_readable?: boolean | null;
      back_issues?: string[] | null;
    }

    // Parse JSON — strip markdown fences if present
    const jsonStr = analysisText.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
    const analysis: DocumentAnalysisResponse = JSON.parse(jsonStr);

    const documentAnalysis: DocumentAnalysis = {
      detected_document_type: analysis.detected_document_type,
      document_type_confidence: analysis.document_type_confidence,
      is_valid_document: analysis.is_valid_document,
      document_quality: analysis.document_quality,
      extracted_info: {
        first_name: analysis.extracted_first_name || null,
        last_name: analysis.extracted_last_name || null,
        full_name: analysis.extracted_full_name || null,
        document_number: analysis.document_number || null,
        expiry_date: analysis.expiry_date || null,
        country: analysis.country || null,
      },
      front_analysis: {
        is_front_side: analysis.is_front_side,
        has_photo: analysis.has_photo,
        is_readable: analysis.is_readable,
        issues: analysis.front_issues || [],
      },
    };

    if (backImage && analysis.is_back_side !== null) {
      documentAnalysis.back_analysis = {
        is_back_side: analysis.is_back_side || false,
        is_readable: analysis.back_is_readable || false,
        issues: analysis.back_issues || [],
      };
    }

    // Compare names
    const extractedFullName = analysis.extracted_full_name ||
      [analysis.extracted_first_name, analysis.extracted_last_name].filter(Boolean).join(' ') ||
      null;

    const profileFullName = [talent.first_name, talent.last_name].filter(Boolean).join(' ') ||
      talent.display_name;

    const nameComparison = compareNames(extractedFullName, profileFullName);

    const profileMatch = {
      names_match: nameComparison.match,
      match_confidence: nameComparison.confidence,
      extracted_name: extractedFullName,
      profile_name: profileFullName,
      mismatch_details: !nameComparison.match && extractedFullName
        ? `Nom sur le document: "${extractedFullName}" vs Profil: "${profileFullName}"`
        : undefined,
    };

    // Calculate verification score — tolerant approach
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];

    // Only reject for clearly invalid documents
    if (!analysis.is_valid_document) {
      rejectionReasons.push('Le document ne semble pas être un document d\'identité valide');
    }
    if (!analysis.is_readable && analysis.document_quality === 'POOR') {
      rejectionReasons.push('Image illisible — veuillez reprendre la photo');
    }

    // Type mismatch is a warning, not a rejection (user may have selected wrong type)
    if (analysis.detected_document_type !== expectedDocType && analysis.detected_document_type !== 'UNKNOWN') {
      warnings.push(`Type détecté: ${analysis.detected_document_type} (attendu: ${expectedDocType})`);
    }
    if (analysis.document_quality === 'POOR' && analysis.is_readable) {
      warnings.push('La qualité d\'image pourrait être améliorée');
    } else if (analysis.document_quality === 'ACCEPTABLE') {
      warnings.push('La qualité d\'image pourrait être améliorée');
    }
    if (!analysis.has_photo && expectedDocType !== 'STUDENT_CARD') {
      warnings.push('Photo d\'identité non détectée sur le document');
    }
    if (!nameComparison.match) {
      if (extractedFullName) {
        warnings.push(`Nom sur le document: "${extractedFullName}" — vérifiez la correspondance avec votre profil`);
      } else {
        warnings.push('Impossible d\'extraire le nom du document');
      }
    } else if (nameComparison.confidence < 80) {
      warnings.push(`Correspondance du nom partielle (${nameComparison.confidence}%)`);
    }

    // Issues from AI — only reject for fraud/expiry
    if (documentAnalysis.front_analysis.issues.length > 0) {
      documentAnalysis.front_analysis.issues.forEach(issue => {
        const lower = issue.toLowerCase();
        if (lower.includes('falsif') || lower.includes('faux') || lower.includes('manipul')) {
          rejectionReasons.push(issue);
        } else {
          warnings.push(issue);
        }
      });
    }

    // Weighted scoring
    let score = 100;
    if (!analysis.is_valid_document) score -= 50;
    if (analysis.document_quality === 'POOR') score -= 20;
    else if (analysis.document_quality === 'ACCEPTABLE') score -= 5;
    if (!analysis.is_readable) score -= 25;
    if (!nameComparison.match && extractedFullName) score -= 10;
    if (!analysis.has_photo && expectedDocType !== 'STUDENT_CARD') score -= 5;
    score -= warnings.length * 2;
    score = Math.max(0, Math.min(100, score));

    // Verified if no hard rejections and score >= 50
    const isVerified = rejectionReasons.length === 0 && score >= 50;

    logger.info(`KYC verification complete: ${isVerified ? 'VERIFIED' : 'REJECTED'} (score: ${score})`);

    return {
      success: true,
      is_verified: isVerified,
      verification_score: Math.round(score),
      document_analysis: documentAnalysis,
      profile_match: profileMatch,
      rejection_reasons: rejectionReasons,
      warnings,
    };
  } catch (error) {
    logger.error('KYC verification error:', error);
    return errorResult(
      ['Erreur lors de l\'analyse'],
      ['Erreur technique lors de la vérification'],
      talent?.display_name || null,
      error instanceof Error ? error.message : 'Verification failed'
    );
  }
}

/**
 * Quick validation without full verification (for pre-checks)
 */
export async function quickDocumentCheck(
  frontImageUrl: string
): Promise<{ valid: boolean; document_type: DocumentType | 'UNKNOWN'; message: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { valid: true, document_type: 'UNKNOWN', message: 'Vérification automatique non disponible' };
  }

  try {
    const frontImage = await imageToBase64(frontImageUrl);
    if (!frontImage) {
      return { valid: false, document_type: 'UNKNOWN', message: 'Image non accessible' };
    }

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: MODEL_SEARCH,
      messages: [
        { role: 'system', content: KYC_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildQuickCheckPrompt() },
            {
              type: 'image_url',
              image_url: { url: `data:${frontImage.mimeType};base64,${frontImage.data}`, detail: 'low' },
            },
          ],
        },
      ],
    });

    const resultText = completion.choices[0]?.message?.content?.trim();
    if (!resultText) {
      return { valid: true, document_type: 'UNKNOWN', message: 'Vérification temporairement indisponible' };
    }

    try {
      const jsonStr = resultText.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(jsonStr) as { is_document: boolean; type: DocumentType | 'UNKNOWN'; message: string };
      return {
        valid: parsed.is_document,
        document_type: parsed.type,
        message: parsed.message,
      };
    } catch (error) {
      logger.error('Error parsing quick check response:', error);
      return { valid: true, document_type: 'UNKNOWN', message: 'Erreur lors de l\'analyse' };
    }
  } catch (error) {
    logger.error('Quick document check error:', error);
    return { valid: true, document_type: 'UNKNOWN', message: 'Vérification non effectuée' };
  }
}
