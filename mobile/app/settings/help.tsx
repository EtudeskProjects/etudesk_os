import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  ChevronRight,
  User,
  Building2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';

type TabType = 'talent' | 'organization';

interface FAQ {
  id: string;
  question: string;
}

const TALENT_FAQS: FAQ[] = [
  { id: '1', question: 'Comment créer et optimiser mon profil pour attirer les recruteurs ?' },
  { id: '2', question: 'Comment postuler à une opportunité sur Etudesk ?' },
  { id: '3', question: 'Comment fonctionne le système de mentorat ?' },
  { id: '4', question: 'Comment réserver une session avec un mentor ?' },
  { id: '5', question: 'Comment vérifier mon identité (KYC) et pourquoi est-ce important ?' },
  { id: '6', question: 'Comment configurer mes moyens de paiement pour le mentorat ?' },
  { id: '7', question: 'Comment rejoindre une communauté sur Etudesk ?' },
  { id: '8', question: 'Comment réserver un espace (salle de réunion, formation, coworking) ?' },
  { id: '9', question: 'Comment suivre mes candidatures et leurs statuts ?' },
  { id: '10', question: 'Comment modifier mes préférences de notifications ?' },
];

const ORGANIZATION_FAQS: FAQ[] = [
  { id: '1', question: 'Comment créer et configurer mon organisation sur Etudesk ?' },
  { id: '2', question: 'Comment publier une opportunité d\'emploi ou de stage ?' },
  { id: '3', question: 'Comment gérer les candidatures reçues pour mes offres ?' },
  { id: '4', question: 'Comment créer et animer une communauté pour mon organisation ?' },
  { id: '5', question: 'Comment ajouter des membres à mon équipe de gestion ?' },
  { id: '6', question: 'Comment vérifier l\'identité de mon organisation ?' },
  { id: '7', question: 'Comment accéder aux statistiques et au tableau de bord ?' },
  { id: '8', question: 'Comment contacter et recruter des talents sur la plateforme ?' },
  { id: '9', question: 'Comment gérer les espaces et événements de mon organisation ?' },
  { id: '10', question: 'Comment configurer les notifications pour mon organisation ?' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('talent');

  const faqs = activeTab === 'talent' ? TALENT_FAQS : ORGANIZATION_FAQS;

  const handleQuestionPress = (question: string) => {
    // Navigate to assistant with the question as a prompt
    router.push({
      pathname: '/(tabs)/assistant',
      params: { prompt: question },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Aide</Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.gray100 }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'talent' && { backgroundColor: colors.surface },
          ]}
          onPress={() => setActiveTab('talent')}
          activeOpacity={0.8}
        >
          <User
            size={ICON.size.sm}
            color={activeTab === 'talent' ? colors.primary : colors.gray500}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'talent' ? colors.primary : colors.gray500 },
          ]}>
            Talent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'organization' && { backgroundColor: colors.surface },
          ]}
          onPress={() => setActiveTab('organization')}
          activeOpacity={0.8}
        >
          <Building2
            size={ICON.size.sm}
            color={activeTab === 'organization' ? colors.primary : colors.gray500}
            strokeWidth={ICON.strokeWidth}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'organization' ? colors.primary : colors.gray500 },
          ]}>
            Organisation
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={[styles.infoBanner, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
        <MessageCircle size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.infoBannerText, { color: colors.primary }]}>
          Clique sur une question pour obtenir une réponse personnalisée de notre assistant
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* FAQ List */}
        <View style={[styles.faqList, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          {faqs.map((faq, index) => {
            const isLast = index === faqs.length - 1;

            return (
              <TouchableOpacity
                key={faq.id}
                style={[
                  styles.faqItem,
                  { borderBottomColor: colors.gray100 },
                  isLast && styles.faqItemLast,
                ]}
                onPress={() => handleQuestionPress(faq.question)}
                activeOpacity={0.7}
              >
                <View style={[styles.faqNumber, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                  <Text style={[styles.faqNumberText, { color: colors.primary }]}>{faq.id}</Text>
                </View>
                <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>
                  {faq.question}
                </Text>
                <ChevronRight size={ICON.size.md} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Contact Support */}
        <TouchableOpacity
          style={[styles.supportButton, { borderColor: colors.primary }]}
          onPress={() => router.push({
            pathname: '/(tabs)/assistant',
            params: { focusInput: 'true' },
          })}
        >
          <HelpCircle size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.supportButtonText, { color: colors.primary }]}>
            Ma question n'est pas dans la liste
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    padding: 4,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.lg,
  },

  infoBannerText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // FAQ List
  faqList: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },

  faqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.md,
  },

  faqItemLast: {
    borderBottomWidth: 0,
  },

  faqNumber: {
    width: 28,
    height: 28,
    borderRadius: BORDER.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  faqNumberText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  faqQuestion: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  // Support Button
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderStyle: 'dashed',
    borderRadius: BORDER.radius.sm,
  },

  supportButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
