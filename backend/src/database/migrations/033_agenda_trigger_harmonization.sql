-- 033 — Agenda trigger harmonization
-- Ensures existing databases keep agenda_triggers.updated_at in sync.

DROP TRIGGER IF EXISTS trigger_agenda_triggers_updated_at ON agenda_triggers;

CREATE TRIGGER trigger_agenda_triggers_updated_at
    BEFORE UPDATE ON agenda_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
