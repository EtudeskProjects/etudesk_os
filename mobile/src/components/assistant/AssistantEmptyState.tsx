import { ScrollView, Text, View } from 'react-native';
import { TYPOGRAPHY } from '../../constants/theme';
import { PulsingOrb } from '../copilot';

type Mode = 'explore' | 'study';

interface AssistantEmptyStateProps {
  activeMode: Mode;
  colors: {
    primary: string;
    textPrimary: string;
  };
  firstName: string;
  isOrganizationSpace: boolean;
  organizationName?: string | null | undefined;
  styles: Record<string, any>;
  t: (key: string, params?: Record<string, any>) => string;
}

export function AssistantEmptyState({
  activeMode,
  colors,
  firstName,
  isOrganizationSpace,
  organizationName,
  styles,
  t,
}: AssistantEmptyStateProps) {
  return (
    <ScrollView
      style={styles.emptyStateScroll}
      contentContainerStyle={styles.emptyState}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.orbContainer}>
        <PulsingOrb size={100} />
      </View>
      {isOrganizationSpace ? (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          <Text
            style={{
              color: colors.primary,
              fontFamily: TYPOGRAPHY.fontFamily.bold,
              fontWeight: TYPOGRAPHY.fontWeight.bold,
            }}
          >
            {organizationName || t('myReservations.detail.organizationFallback')}
          </Text>{' '}
          {t('screens.assistant.orgGreeting')}
        </Text>
      ) : activeMode === 'study' ? (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {t('screens.assistant.studyGreeting', { name: firstName })}
        </Text>
      ) : (
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {t('screens.assistant.exploreGreeting', { name: firstName })}
        </Text>
      )}
    </ScrollView>
  );
}
