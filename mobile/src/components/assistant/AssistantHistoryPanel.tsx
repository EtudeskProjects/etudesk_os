import { Modal, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { BrainCircuit, Pin, PinOff, Telescope, Trash2, X } from 'lucide-react-native';
import { ICON, OPACITY, withOpacity } from '../../constants/theme';
import { formatRelativeTime } from '../../utils/date';
import { SessionSummary } from '../../services/copilotService';
import { Button, IconButton, SelectCard } from '../ui';

type Mode = 'explore' | 'study';

const MODE_ICONS = {
  explore: Telescope,
  study: BrainCircuit,
};

interface AssistantHistoryPanelProps {
  colors: {
    background: string;
    borderColor: string;
    primary: string;
    surface: string;
    textDisabled: string;
    textOnPrimary: string;
    textPrimary: string;
    textSecondary: string;
  };
  handleDeleteSession: (id: string) => void;
  handleRenameSession: () => void;
  handleSelectSession: (session: SessionSummary) => void;
  handleStartRename: (session: SessionSummary) => void;
  handleTogglePin: (session: SessionSummary) => void;
  historyFilter: 'all' | 'explore' | 'study';
  isOrganizationSpace: boolean;
  modeColors: Record<Mode, { bg: string; text: string }>;
  renameText: string;
  renamingSession: SessionSummary | null;
  sessionId: string | null;
  sessions: SessionSummary[];
  setHistoryFilter: (value: 'all' | 'explore' | 'study') => void;
  setRenameText: (value: string) => void;
  setRenamingSession: (session: SessionSummary | null) => void;
  setShowHistory: (value: boolean) => void;
  styles: Record<string, any>;
  t: (key: string) => string;
}

export function AssistantHistoryPanel({
  colors,
  handleDeleteSession,
  handleRenameSession,
  handleSelectSession,
  handleStartRename,
  handleTogglePin,
  historyFilter,
  isOrganizationSpace,
  modeColors,
  renameText,
  renamingSession,
  sessionId,
  sessions,
  setHistoryFilter,
  setRenameText,
  setRenamingSession,
  setShowHistory,
  styles,
  t,
}: AssistantHistoryPanelProps) {
  const filteredSessions =
    historyFilter === 'all' ? sessions : sessions.filter((session) => session.mode === historyFilter);

  const pinnedSessions = filteredSessions.filter((session) => session.isPinned);
  const unpinnedSessions = filteredSessions.filter((session) => !session.isPinned);
  const sections = [{ title: '', data: [...pinnedSessions, ...unpinnedSessions] }];

  const filterTabs = [
    { key: 'all' as const, label: t('screens.assistant.filterAll') },
    { key: 'explore' as const, label: t('screens.assistant.filterDiscover') },
    ...(!isOrganizationSpace ? [{ key: 'study' as const, label: t('screens.assistant.filterStudy') }] : []),
  ];

  return (
    <View style={[styles.historyPanel, { backgroundColor: colors.background }]}>
      <View style={[styles.historyHeader, { borderBottomColor: colors.borderColor }]}>
        <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>
          {t('screens.assistant.sessionArchives')}
        </Text>
        <IconButton
          onPress={() => setShowHistory(false)}
          icon={<X size={20} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('screens.explore.close')}
          size="sm"
          variant="ghost"
        />
      </View>

      <View style={[styles.historyFilterRow, { borderBottomColor: colors.borderColor }]}>
        {filterTabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setHistoryFilter(tab.key)}
            style={[
              styles.historyFilterTab,
              historyFilter === tab.key && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.historyFilterTabText,
                { color: historyFilter === tab.key ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionList
        style={styles.historyList}
        sections={sections}
        keyExtractor={(session) => session.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={[styles.historySectionHeader, { borderBottomColor: colors.borderColor }]}>
              <Pin size={12} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.historySectionTitle, { color: colors.primary }]}>{section.title}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[styles.historyEmpty, { color: colors.textSecondary }]}>
            {t('screens.assistant.noConversation')}
          </Text>
        }
        renderItem={({ item: session }) => {
          const sessionMode = (session.mode as Mode) || 'explore';
          const SessionModeIcon = MODE_ICONS[sessionMode] || Telescope;
          const modeColor = modeColors[sessionMode]?.text || colors.primary;

          return (
            <SelectCard
              style={[
                styles.historyItem,
                { borderBottomColor: colors.borderColor },
                session.id === sessionId && { backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
                { borderWidth: 0, borderColor: 'transparent', borderRadius: 0 },
              ]}
              onPress={() => handleSelectSession(session)}
              onLongPress={() => handleStartRename(session)}
              selected={false}
              accessibilityLabel={session.title || t('screens.assistant.untitledSession')}
            >
              <View style={styles.historyItemContent}>
                <View style={styles.historyModeBadge}>
                  <View style={[styles.historyModeRail, { backgroundColor: modeColor }]} />
                  <SessionModeIcon
                    size={22}
                    color={modeColor}
                    strokeWidth={ICON.strokeWidthThick}
                  />
                </View>
                <View style={styles.historyItemText}>
                  <Text style={[styles.historyItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {session.title || t('screens.assistant.untitledSession')}
                  </Text>
                  <Text style={[styles.historyItemMeta, { color: colors.textSecondary }]}>
                    {session.messageCount} {t('gestion.memberDetails.tabMessages').toLowerCase()} ·{' '}
                    {formatRelativeTime(session.lastMessageAt || session.createdAt)}
                    {session.createdByName ? ` · ${session.createdByName}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.historyItemActions}>
                <IconButton
                  onPress={() => handleTogglePin(session)}
                  icon={
                    session.isPinned ? (
                      <PinOff size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    ) : (
                      <Pin size={14} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />
                    )
                  }
                  accessibilityLabel={
                    session.isPinned
                      ? t('screens.assistant.unpinConversation')
                      : t('screens.assistant.pinConversation')
                  }
                  size="sm"
                  variant="ghost"
                />
                <IconButton
                  onPress={() => handleDeleteSession(session.id)}
                  icon={<Trash2 size={14} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel={t('screens.assistant.deleteConversation')}
                  size="sm"
                  variant="ghost"
                />
              </View>
            </SelectCard>
          );
        }}
      />

      <Modal
        visible={!!renamingSession}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingSession(null)}
      >
        <Pressable style={styles.renameModalOverlay} onPress={() => setRenamingSession(null)}>
          <View
            style={[styles.renameModalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.renameModalTitle, { color: colors.textPrimary }]}>
              {t('screens.assistant.renameSessionTitle')}
            </Text>
            <TextInput
              style={[
                styles.renameInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.borderColor,
                  backgroundColor: colors.surface,
                },
              ]}
              value={renameText}
              onChangeText={setRenameText}
              placeholder={t('screens.assistant.renameSessionPlaceholder')}
              placeholderTextColor={colors.textDisabled}
              autoFocus
              maxLength={100}
              onSubmitEditing={handleRenameSession}
              returnKeyType="done"
            />
            <View style={styles.renameModalActions}>
              <Button title={t('common.cancel')} onPress={() => setRenamingSession(null)} variant="secondary" size="sm" />
              <Button
                title={t('common.save')}
                onPress={handleRenameSession}
                variant="primary"
                size="sm"
                disabled={!renameText.trim()}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
