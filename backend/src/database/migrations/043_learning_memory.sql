-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 043: Learning Memory for Copilot Study Mode
-- Tables for tracking learning progress, flashcards, quizzes, and preferences
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEARNING TOPICS
-- Tracks subjects studied by each talent with mastery levels
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learning_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_name VARCHAR(255) NOT NULL,
    topic_slug VARCHAR(255) NOT NULL,
    parent_topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,

    -- Progress tracking
    first_studied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
    total_study_time_minutes INTEGER DEFAULT 0,

    -- Activity counters
    flashcards_created INTEGER DEFAULT 0,
    flashcards_reviewed INTEGER DEFAULT 0,
    quizzes_taken INTEGER DEFAULT 0,
    quizzes_passed INTEGER DEFAULT 0,
    code_exercises_completed INTEGER DEFAULT 0,
    videos_watched INTEGER DEFAULT 0,
    articles_read INTEGER DEFAULT 0,

    -- Scores
    average_quiz_score DECIMAL(5,2),
    best_quiz_score INTEGER,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    source_document_ids UUID[] DEFAULT '{}', -- Links to talent_documents

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(talent_id, topic_slug)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEARNING FLASHCARDS
-- Individual flashcards with spaced repetition (SM-2 algorithm)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learning_flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE CASCADE,

    -- Card content
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    hint TEXT,
    explanation TEXT,
    tags TEXT[] DEFAULT '{}',
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),

    -- Spaced Repetition Fields (SM-2 Algorithm)
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    interval_days DECIMAL(10,2) DEFAULT 1, -- Can be fractional for sub-day intervals
    ease_factor DECIMAL(4,2) DEFAULT 2.5 CHECK (ease_factor >= 1.3),
    repetitions INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0, -- Times card was forgotten

    -- Review history
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    last_quality INTEGER CHECK (last_quality >= 0 AND last_quality <= 5), -- SM-2 quality rating
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,

    -- Source tracking
    source_type VARCHAR(50), -- 'generated', 'imported', 'user_created'
    source_document_id UUID REFERENCES talent_documents(id) ON DELETE SET NULL,
    copilot_session_id UUID REFERENCES copilot_sessions(id) ON DELETE SET NULL,

    -- Status
    is_suspended BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEARNING SESSIONS
-- Tracks individual study sessions
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
    copilot_session_id UUID REFERENCES copilot_sessions(id) ON DELETE SET NULL,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- Activities performed
    activities JSONB DEFAULT '[]'::jsonb, -- [{ type, count, score, duration }]

    -- Summary
    flashcards_reviewed INTEGER DEFAULT 0,
    flashcards_correct INTEGER DEFAULT 0,
    quiz_questions_answered INTEGER DEFAULT 0,
    quiz_questions_correct INTEGER DEFAULT 0,
    code_exercises_attempted INTEGER DEFAULT 0,
    code_exercises_passed INTEGER DEFAULT 0,

    -- Notes
    notes TEXT,
    mood VARCHAR(20), -- 'focused', 'distracted', 'tired', 'energized'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEARNING QUIZ RESULTS
-- Stores completed quiz attempts
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learning_quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE CASCADE,
    session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
    copilot_session_id UUID REFERENCES copilot_sessions(id) ON DELETE SET NULL,

    -- Quiz metadata
    quiz_title VARCHAR(255),
    quiz_type VARCHAR(50) DEFAULT 'adaptive', -- 'adaptive', 'fixed', 'review'
    difficulty VARCHAR(20),

    -- Questions and answers
    questions JSONB NOT NULL, -- Full quiz data with user answers
    total_questions INTEGER NOT NULL,

    -- Scoring
    score INTEGER NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    passed BOOLEAN NOT NULL,
    passing_score INTEGER DEFAULT 70,

    -- Timing
    time_limit_seconds INTEGER,
    time_taken_seconds INTEGER,

    -- Analysis
    strengths TEXT[], -- Topics user did well on
    weaknesses TEXT[], -- Topics needing improvement
    recommendations TEXT[],

    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEARNING PREFERENCES
-- User's learning preferences and global stats
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learning_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    -- Learning style
    learning_style VARCHAR(50) DEFAULT 'visual'
        CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading')),
    preferred_difficulty VARCHAR(20) DEFAULT 'medium'
        CHECK (preferred_difficulty IN ('easy', 'medium', 'hard', 'adaptive')),
    preferred_session_length INTEGER DEFAULT 25, -- minutes (pomodoro default)

    -- Goals
    daily_goal_minutes INTEGER DEFAULT 30,
    weekly_goal_minutes INTEGER DEFAULT 150,
    monthly_goal_topics INTEGER DEFAULT 4,

    -- Streaks and stats
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_study_date DATE,
    total_study_time_minutes INTEGER DEFAULT 0,
    total_topics_studied INTEGER DEFAULT 0,
    total_flashcards_reviewed INTEGER DEFAULT 0,
    total_quizzes_completed INTEGER DEFAULT 0,
    average_quiz_score DECIMAL(5,2),

    -- Gamification
    experience_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    achievements JSONB DEFAULT '[]'::jsonb, -- [{ id, name, unlockedAt }]
    badges JSONB DEFAULT '[]'::jsonb,

    -- Notifications
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_time TIME DEFAULT '09:00:00',
    reminder_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 0=Sun, 1=Mon, etc.

    -- UI preferences
    show_progress_bar BOOLEAN DEFAULT TRUE,
    show_streak_counter BOOLEAN DEFAULT TRUE,
    enable_sounds BOOLEAN DEFAULT TRUE,
    dark_mode_cards BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(talent_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEARNING CODE EXERCISES
-- Stores code exercise attempts and solutions
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learning_code_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
    session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,

    -- Exercise metadata
    title VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium',
    exercise_type VARCHAR(50) DEFAULT 'implement', -- 'implement', 'debug', 'refactor', 'complete'

    -- Content
    instructions TEXT NOT NULL,
    starter_code TEXT,
    user_solution TEXT,
    reference_solution TEXT,
    test_cases JSONB, -- [{ input, expectedOutput, passed }]

    -- Results
    tests_passed INTEGER DEFAULT 0,
    tests_total INTEGER DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    execution_time_ms INTEGER,
    memory_used_kb INTEGER,

    -- Attempts
    attempt_count INTEGER DEFAULT 1,
    hints_used INTEGER DEFAULT 0,

    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Learning topics
CREATE INDEX idx_learning_topics_talent ON learning_topics(talent_id);
CREATE INDEX idx_learning_topics_slug ON learning_topics(talent_id, topic_slug);
CREATE INDEX idx_learning_topics_mastery ON learning_topics(talent_id, mastery_level DESC);
CREATE INDEX idx_learning_topics_last_studied ON learning_topics(talent_id, last_studied_at DESC);

-- Flashcards - optimized for spaced repetition queries
CREATE INDEX idx_learning_flashcards_talent ON learning_flashcards(talent_id);
CREATE INDEX idx_learning_flashcards_topic ON learning_flashcards(topic_id);
CREATE INDEX idx_learning_flashcards_review_queue ON learning_flashcards(talent_id, next_review_at)
    WHERE is_suspended = FALSE AND is_archived = FALSE;
CREATE INDEX idx_learning_flashcards_due ON learning_flashcards(talent_id, next_review_at)
    WHERE is_suspended = FALSE AND is_archived = FALSE;

-- Sessions
CREATE INDEX idx_learning_sessions_talent ON learning_sessions(talent_id);
CREATE INDEX idx_learning_sessions_date ON learning_sessions(talent_id, started_at DESC);
CREATE INDEX idx_learning_sessions_topic ON learning_sessions(topic_id);

-- Quiz results
CREATE INDEX idx_learning_quiz_results_talent ON learning_quiz_results(talent_id);
CREATE INDEX idx_learning_quiz_results_topic ON learning_quiz_results(topic_id);
CREATE INDEX idx_learning_quiz_results_date ON learning_quiz_results(talent_id, completed_at DESC);

-- Code exercises
CREATE INDEX idx_learning_code_exercises_talent ON learning_code_exercises(talent_id);
CREATE INDEX idx_learning_code_exercises_topic ON learning_code_exercises(topic_id);
CREATE INDEX idx_learning_code_exercises_language ON learning_code_exercises(talent_id, language);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update topic stats when flashcard is reviewed
CREATE OR REPLACE FUNCTION update_topic_flashcard_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_reviewed_at IS NOT NULL AND (OLD.last_reviewed_at IS NULL OR NEW.last_reviewed_at > OLD.last_reviewed_at) THEN
        UPDATE learning_topics
        SET
            flashcards_reviewed = flashcards_reviewed + 1,
            last_studied_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.topic_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_topic_flashcard_stats
AFTER UPDATE ON learning_flashcards
FOR EACH ROW
EXECUTE FUNCTION update_topic_flashcard_stats();

-- Update preferences stats when session ends
CREATE OR REPLACE FUNCTION update_preferences_after_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL AND NEW.duration_minutes IS NOT NULL THEN
        UPDATE learning_preferences
        SET
            total_study_time_minutes = total_study_time_minutes + NEW.duration_minutes,
            last_study_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE talent_id = NEW.talent_id;

        -- Update streak
        UPDATE learning_preferences
        SET
            current_streak_days = CASE
                WHEN last_study_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak_days + 1
                WHEN last_study_date = CURRENT_DATE THEN current_streak_days
                ELSE 1
            END,
            longest_streak_days = GREATEST(longest_streak_days, current_streak_days + 1)
        WHERE talent_id = NEW.talent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_preferences_after_session
AFTER UPDATE ON learning_sessions
FOR EACH ROW
EXECUTE FUNCTION update_preferences_after_session();

-- Auto-create preferences for new talents
CREATE OR REPLACE FUNCTION create_default_learning_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO learning_preferences (talent_id)
    VALUES (NEW.id)
    ON CONFLICT (talent_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_learning_preferences') THEN
        CREATE TRIGGER trigger_create_learning_preferences
        AFTER INSERT ON talents
        FOR EACH ROW
        EXECUTE FUNCTION create_default_learning_preferences();
    END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Calculate SM-2 next review interval
CREATE OR REPLACE FUNCTION calculate_sm2_interval(
    p_quality INTEGER, -- 0-5 rating
    p_repetitions INTEGER,
    p_ease_factor DECIMAL,
    p_interval DECIMAL
) RETURNS TABLE(
    new_interval DECIMAL,
    new_ease_factor DECIMAL,
    new_repetitions INTEGER
) AS $$
DECLARE
    v_ease DECIMAL;
    v_interval DECIMAL;
    v_reps INTEGER;
BEGIN
    -- SM-2 Algorithm
    v_ease := p_ease_factor;
    v_interval := p_interval;
    v_reps := p_repetitions;

    IF p_quality < 3 THEN
        -- Failed: reset
        v_reps := 0;
        v_interval := 1;
    ELSE
        -- Success
        IF v_reps = 0 THEN
            v_interval := 1;
        ELSIF v_reps = 1 THEN
            v_interval := 6;
        ELSE
            v_interval := v_interval * v_ease;
        END IF;
        v_reps := v_reps + 1;
    END IF;

    -- Update ease factor
    v_ease := v_ease + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
    IF v_ease < 1.3 THEN
        v_ease := 1.3;
    END IF;

    new_interval := v_interval;
    new_ease_factor := v_ease;
    new_repetitions := v_reps;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Get flashcards due for review
CREATE OR REPLACE FUNCTION get_due_flashcards(
    p_talent_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_topic_id UUID DEFAULT NULL
) RETURNS SETOF learning_flashcards AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM learning_flashcards
    WHERE talent_id = p_talent_id
        AND next_review_at <= CURRENT_TIMESTAMP
        AND is_suspended = FALSE
        AND is_archived = FALSE
        AND (p_topic_id IS NULL OR topic_id = p_topic_id)
    ORDER BY next_review_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Calculate topic mastery based on activities
CREATE OR REPLACE FUNCTION calculate_topic_mastery(p_topic_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_quiz_score DECIMAL;
    v_flashcard_retention DECIMAL;
    v_exercise_rate DECIMAL;
    v_mastery INTEGER;
BEGIN
    SELECT
        COALESCE(AVG(percentage), 0),
        CASE WHEN flashcards_reviewed > 0
            THEN (SELECT COUNT(*)::DECIMAL / NULLIF(flashcards_reviewed, 0) * 100
                  FROM learning_flashcards f
                  WHERE f.topic_id = p_topic_id AND ease_factor > 2.5)
            ELSE 0 END
    INTO v_quiz_score, v_flashcard_retention
    FROM learning_topics t
    LEFT JOIN learning_quiz_results q ON q.topic_id = t.id
    WHERE t.id = p_topic_id;

    -- Weighted average: 40% quiz, 40% flashcard retention, 20% time spent
    v_mastery := LEAST(100, GREATEST(0,
        (v_quiz_score * 0.4 + v_flashcard_retention * 0.4 + 20)::INTEGER
    ));

    UPDATE learning_topics
    SET mastery_level = v_mastery, updated_at = CURRENT_TIMESTAMP
    WHERE id = p_topic_id;

    RETURN v_mastery;
END;
$$ LANGUAGE plpgsql;
