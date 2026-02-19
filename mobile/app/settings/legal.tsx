import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, FileText, Shield, Scale, ExternalLink } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/contexts/I18nContext';
import { IconButton, Button } from '../../src/components/ui';

const LEGAL_URLS = {
  terms: 'https://etudesk.com/terms',
  privacy: 'https://etudesk.com/privacy',
  legal: 'https://etudesk.com/mentions-legales',
};

export default function LegalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const openLink = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const links = [
    {
      id: 'terms',
      label: t('legal.terms'),
      description: t('legal.termsDesc'),
      icon: FileText,
      url: LEGAL_URLS.terms,
    },
    {
      id: 'privacy',
      label: t('legal.privacy'),
      description: t('legal.privacyDesc'),
      icon: Shield,
      url: LEGAL_URLS.privacy,
    },
    {
      id: 'legal',
      label: t('legal.legalNotice'),
      description: t('legal.legalNoticeDesc'),
      icon: Scale,
      url: LEGAL_URLS.legal,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('legal.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Links */}
      <View style={styles.linksContainer}>
        {links.map((link) => {
          const LinkIcon = link.icon;
          return (
            <Button
              key={link.id}
              title={link.label}
              onPress={() => openLink(link.url)}
              variant="outline"
              fullWidth
              icon={<LinkIcon size={ICON.size.sm} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
              iconRight={<ExternalLink size={ICON.size.sm} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
              style={styles.linkButton}
              textStyle={[styles.linkText, { color: colors.textPrimary }]}
            />
          );
        })}

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          {t('legal.footer')}
        </Text>
      </View>
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
    borderBottomWidth: BORDER.width.thin,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  headerSpacer: {
    width: 40,
  },
  linksContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  linkButton: {
    justifyContent: 'flex-start',
    paddingVertical: SPACING.md,
  },
  linkText: {
    flex: 1,
    textAlign: 'left',
  },
  footer: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.5,
  },
});
