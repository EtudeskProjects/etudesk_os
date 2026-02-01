-- ═══════════════════════════════════════════════════════════════
-- Migration 049: Increase document limit from 20 to 100
-- ═══════════════════════════════════════════════════════════════

-- Update the trigger function to enforce 100 documents per talent
CREATE OR REPLACE FUNCTION check_talent_document_limit()
RETURNS TRIGGER AS $$
DECLARE
    doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count
    FROM talent_documents
    WHERE talent_id = NEW.talent_id
    AND deleted_at IS NULL;

    IF doc_count >= 100 THEN
        RAISE EXCEPTION 'Document limit exceeded: A talent can have maximum 100 documents';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the helper function
CREATE OR REPLACE FUNCTION can_talent_upload_document(p_talent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_talent_document_count(p_talent_id) < 100;
END;
$$ LANGUAGE plpgsql;
