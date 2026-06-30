/**
 * Study Quiz — deterministic steering helpers.
 *
 * Extracted from routes/copilot.ts so that both the production route AND the
 * study-steering test harness share a SINGLE source of truth for the
 * deterministic quiz evaluation logic. Do not duplicate these elsewhere.
 *
 * The deterministic quiz evaluation is the key conversation-steering mechanism
 * in mode Étudier: it tracks the active quiz, parses the learner's answer,
 * evaluates isCorrect strictly, and injects a [DETERMINISTIC_QUIZ_CONTEXT]
 * hint into the user message so the model cannot drift across questions
 * or re-grade from a shuffled option letter/position.
 */

import crypto from 'crypto';

// --- Types ---

export interface QuizBlock {
  topic?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface ActiveQuizState {
  quizId: string;
  topic?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  sourceMessageId?: string;
  sourceMessageAt?: string;
  awaitingAnswer: boolean;
}

export interface QuizEvaluation {
  selectedIndex: number;
  selectedOption: string;
  isCorrect: boolean;
}

export interface StudyQuizProgress {
  answered: number;
  correct: number;
  target?: number;
  phase?: 'diagnostic' | 'exam' | 'practice';
}

// --- Helpers ---

export function normalizeQuizText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toQuizLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function buildQuizId(quiz: QuizBlock): string {
  const payload = `${quiz.topic || ''}|${quiz.question}|${quiz.options.join('|')}|${quiz.correctAnswer}`;
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

export function parseQuizBlock(raw: string): QuizBlock | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
    const options = Array.isArray(parsed.options)
      ? parsed.options.map((o: any) => String(o || '').trim()).filter(Boolean)
      : [];
    const correctAnswer = Number(parsed.correctAnswer);

    if (!question || options.length < 2) return null;
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) return null;

    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic.trim() : undefined,
      question,
      options,
      correctAnswer,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function extractLastQuizBlock(content: string): QuizBlock | null {
  const regex = /```quiz\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let last: QuizBlock | null = null;

  while ((match = regex.exec(content)) !== null) {
    const parsed = parseQuizBlock(match[1].trim());
    if (parsed) last = parsed;
  }

  return last;
}

export function parseQuizAnswer(userMessage: string, options: string[]): number | null {
  const raw = userMessage.trim();
  if (!raw || options.length === 0) return null;

  // A) / A. / A: / "Option A" / "Réponse A"
  const letterMatch = raw.match(/^(?:option|reponse|réponse)?\s*([A-Z])(?:[\)\].:\s-]|$)/i);
  if (letterMatch) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }

  const normalizedRaw = normalizeQuizText(raw.replace(/^[A-Z]\)\s*/i, ''));
  if (!normalizedRaw) return null;

  // Exact option text
  const exact = options.findIndex((o) => normalizeQuizText(o) === normalizedRaw);
  if (exact >= 0) return exact;

  // "1", "2", ... as an option index only after exact text matching.
  // Otherwise numeric option texts such as "3" are misread as option #3.
  const numMatch = raw.match(/^([1-9][0-9]*)\s*$/);
  if (numMatch) {
    const idx = Number(numMatch[1]) - 1;
    if (idx >= 0 && idx < options.length) return idx;
  }

  // Containment fallback (only if unique)
  const candidates = options
    .map((o, i) => ({ i, n: normalizeQuizText(o) }))
    .filter((o) => normalizedRaw.includes(o.n) || o.n.includes(normalizedRaw));
  return candidates.length === 1 ? candidates[0].i : null;
}

export function buildStudyQuizHint(params: { activeQuiz: ActiveQuizState; evaluation: QuizEvaluation; progress?: StudyQuizProgress }): string {
  const { activeQuiz, evaluation, progress } = params;
  const optionsBlock = activeQuiz.options
    .map((opt, idx) => `${toQuizLetter(idx)}) ${opt}`)
    .join('\n');
  const progressBlock = progress
    ? [
        `phase=${progress.phase || 'diagnostic'}`,
        `answered_count=${progress.answered}`,
        `correct_count=${progress.correct}`,
        `target_count=${progress.target || 3}`,
        progress.phase === 'diagnostic' && progress.target && progress.answered >= progress.target
          ? progress.correct >= progress.target
            ? 'Diagnostic target reached: do NOT emit another quiz. Summarize the diagnostic and move to applied practice before any profile update.'
            : 'Diagnostic target reached with missed answers: do NOT emit another quiz. Summarize the diagnostic and emit exactly one remediation component (flashcard, exercise, or steps) for the weakest concept.'
          : null,
      ].filter(Boolean)
    : [];

  return [
    '[DETERMINISTIC_QUIZ_CONTEXT]',
    'You must evaluate ONLY the currently active quiz below.',
    'Do not re-evaluate older questions and do not mix with previous answers.',
    `quiz_id=${activeQuiz.quizId}`,
    `question=${activeQuiz.question}`,
    'options:',
    optionsBlock,
    `correct_index=${activeQuiz.correctAnswer}`,
    `user_selected_index=${evaluation.selectedIndex}`,
    `user_selected_option=${evaluation.selectedOption}`,
    `is_correct=${evaluation.isCorrect ? 'true' : 'false'}`,
    ...progressBlock,
    'Instruction: acknowledge this specific answer, explain briefly, then continue to the next pedagogical step.',
    '[/DETERMINISTIC_QUIZ_CONTEXT]',
  ].join('\n');
}
