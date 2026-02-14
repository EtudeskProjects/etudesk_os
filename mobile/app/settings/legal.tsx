import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { IconButton } from '../../src/components/ui';


type Tab = 'terms' | 'privacy' | 'legal';

export default function LegalScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<Tab>('terms');

    const TABS: { id: Tab; label: string }[] = [
        { id: 'terms', label: 'CGU' },
        { id: 'privacy', label: 'Confidentialité' },
        { id: 'legal', label: 'Mentions légales' },
    ];

    const renderTerms = () => (
        <View style={styles.content}>
            <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>
                Conditions Générales d'Utilisation
            </Text>
            <Text style={[styles.lastUpdated, { color: colors.gray500 }]}>
                Dernière mise à jour : 18 janvier 2026
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Acceptation des conditions</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                En accédant et en utilisant Etudesk, vous acceptez d'être lié par ces Conditions Générales d'Utilisation.
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Description du service</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Etudesk est une plateforme de mise en relation entre talents et opportunités professionnelles en Afrique.
                Nous facilitons la connexion entre candidats et organisations pour des opportunités d'emploi, de stage,
                et de formation.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Inscription et compte utilisateur</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Pour utiliser certaines fonctionnalités de la plateforme, vous devez créer un compte. Vous êtes responsable
                de maintenir la confidentialité de vos identifiants de connexion et de toutes les activités effectuées
                sous votre compte.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Utilisation acceptable</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Vous vous engagez à utiliser Etudesk de manière légale et respectueuse. Il est interdit de :
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Publier du contenu offensant, diffamatoire ou illégal
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Usurper l'identité d'une autre personne ou organisation
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Tenter d'accéder de manière non autorisée à notre système
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Utiliser la plateforme à des fins de spam ou de harcèlement
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Propriété intellectuelle</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Tous les contenus, marques, logos et autres éléments de propriété intellectuelle présents sur Etudesk
                sont la propriété d'Etudesk ou de ses concédants de licence. Vous ne pouvez pas les utiliser sans
                autorisation préalable écrite.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Limitation de responsabilité</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Etudesk est fourni "tel quel" sans garantie d'aucune sorte. Nous ne sommes pas responsables des dommages
                directs, indirects, accessoires ou consécutifs résultant de l'utilisation ou de l'impossibilité d'utiliser
                notre plateforme.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Modifications des conditions</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications entreront en
                vigueur dès leur publication sur la plateforme. Votre utilisation continue de Etudesk après la publication
                des modifications constitue votre acceptation de ces modifications.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>8. Résiliation</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous nous réservons le droit de suspendre ou de résilier votre compte à tout moment, sans préavis,
                en cas de violation de ces conditions ou pour toute autre raison que nous jugeons appropriée.
            </Text>
        </View>
    );

    const renderPrivacy = () => (
        <View style={styles.content}>
            <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>
                Politique de Confidentialité
            </Text>
            <Text style={[styles.lastUpdated, { color: colors.gray500 }]}>
                Dernière mise à jour : 18 janvier 2026
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Collecte des données</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous collectons les informations que vous nous fournissez directement lors de :
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • La création de votre compte (nom, email, téléphone)
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • La complétion de votre profil (formation, expérience, compétences)
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • L'utilisation de nos services (candidatures, messages)
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Utilisation des données</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous utilisons vos données pour :
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Fournir et améliorer nos services
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Vous mettre en relation avec des opportunités pertinentes
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Communiquer avec vous sur nos services
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Assurer la sécurité de notre plateforme
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Partage des données</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous ne vendons jamais vos données personnelles. Nous pouvons partager vos informations avec :
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Les organisations auxquelles vous postulez
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Nos prestataires de services (hébergement, analytics)
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Les autorités légales si requis par la loi
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Sécurité des données</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger
                vos données contre tout accès, modification, divulgation ou destruction non autorisés.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Vos droits (RGPD)</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Conformément au RGPD, vous disposez des droits suivants :
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Droit d'accès à vos données personnelles
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Droit de rectification de vos données
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Droit à l'effacement ("droit à l'oubli")
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Droit à la portabilité de vos données
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Droit d'opposition au traitement
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Cookies</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous utilisons des cookies et technologies similaires pour améliorer votre expérience, analyser l'utilisation
                de notre plateforme et personnaliser le contenu. Vous pouvez gérer vos préférences de cookies dans les
                paramètres de votre navigateur.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Conservation des données</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Nous conservons vos données personnelles aussi longtemps que nécessaire pour fournir nos services et
                respecter nos obligations légales. Vous pouvez demander la suppression de votre compte à tout moment.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>8. Contact</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits,
                contactez-nous à : privacy@etudesk.com
            </Text>
        </View>
    );

    const renderLegal = () => (
        <View style={styles.content}>
            <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>
                Mentions Légales
            </Text>
            <Text style={[styles.lastUpdated, { color: colors.gray500 }]}>
                Dernière mise à jour : 18 janvier 2026
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Éditeur de la plateforme</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Etudesk{'\n'}
                Société par Actions Simplifiée{'\n'}
                Capital social : 10 000 000 FCFA{'\n'}
                Siège social : Abidjan, Côte d'Ivoire{'\n'}
                RCCM : CI-ABJ-2024-B-12345{'\n'}
                Email : contact@etudesk.com
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Directeur de la publication</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Lamine Barro{'\n'}
                Président
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Hébergement</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                La plateforme Etudesk est hébergée par :{'\n\n'}
                Google Cloud Platform{'\n'}
                Google LLC{'\n'}
                1600 Amphitheatre Parkway{'\n'}
                Mountain View, CA 94043, USA
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Propriété intellectuelle</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                L'ensemble des éléments de la plateforme Etudesk (textes, images, logos, vidéos, bases de données, etc.)
                sont protégés par le droit d'auteur, le droit des marques et/ou tout autre droit de propriété intellectuelle.
                Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments
                de la plateforme, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite
                préalable d'Etudesk.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Données personnelles</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Etudesk s'engage à respecter la vie privée de ses utilisateurs et à protéger leurs données personnelles
                conformément au Règlement Général sur la Protection des Données (RGPD) et aux lois locales applicables.
                Pour plus d'informations, consultez notre Politique de Confidentialité.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cookies</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                La plateforme Etudesk utilise des cookies pour améliorer l'expérience utilisateur et analyser le trafic.
                En utilisant notre plateforme, vous acceptez l'utilisation de cookies conformément à notre politique de cookies.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Droit applicable et juridiction</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Les présentes mentions légales sont régies par le droit ivoirien. En cas de litige, et à défaut de résolution
                amiable, les tribunaux d'Abidjan seront seuls compétents.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Licences open source</Text>
            <Text style={[styles.paragraph, { color: colors.gray600 }]}>
                Etudesk utilise des bibliothèques et composants open source. Les licences de ces composants sont disponibles
                dans le code source de l'application.
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • React Native - MIT License
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Expo - MIT License
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.gray600 }]}>
                • Lucide React Native - ISC License
            </Text>
        </View>
    );

    return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
                <IconButton
                    onPress={() => router.back()}
                    icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
                    accessibilityLabel="Retour"
                />
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Informations légales</Text>
                <View style={styles.headerSpacer} />
                </View>

            {/* Tabs */}
                <View style={[styles.tabsContainer, { borderBottomColor: colors.borderColor }]}>
                    {TABS.map((tab) => (
	                    <Pressable
	                        key={tab.id}
	                        style={[
	                            styles.tab,
	                            activeTab === tab.id && [styles.activeTab, { borderBottomColor: colors.primary }],
	                        ]}
	                        onPress={() => setActiveTab(tab.id)}
	                        accessibilityRole="button"
	                        accessibilityLabel={tab.label}
	                    >
	                        <Text
	                            style={[
	                                styles.tabText,
	                                { color: colors.gray600 },
	                                activeTab === tab.id && [styles.activeTabText, { color: colors.primary }],
	                            ]}
	                        >
	                            {tab.label}
	                        </Text>
	                    </Pressable>
                    ))}
                </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'terms' && renderTerms()}
                {activeTab === 'privacy' && renderPrivacy()}
                {activeTab === 'legal' && renderLegal()}
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
        borderBottomWidth: BORDER.width.thin,
        borderBottomColor: 'transparent',
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

    headerSpacer: {
        width: 40,
    },

    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: BORDER.width.thin,
        borderBottomColor: 'transparent',
    },

    tab: {
        flex: 1,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },

    activeTab: {
        borderBottomWidth: 2,
    },

    tabText: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontWeight: TYPOGRAPHY.fontWeight.medium,
    },

    activeTabText: {
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },

    scrollView: {
        flex: 1,
    },

    scrollContent: {
        paddingBottom: SPACING.xl,
    },

    content: {
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.lg,
    },

    contentTitle: {
        fontSize: TYPOGRAPHY.fontSize.xl,
        fontWeight: TYPOGRAPHY.fontWeight.bold,
        marginBottom: SPACING.xs,
    },

    lastUpdated: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        marginBottom: SPACING.xl,
    },

    sectionTitle: {
        fontSize: TYPOGRAPHY.fontSize.md,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
    },

    paragraph: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        lineHeight: 20,
        marginBottom: SPACING.sm,
    },

    bulletPoint: {
        fontSize: TYPOGRAPHY.fontSize.sm,
        lineHeight: 20,
        marginBottom: SPACING.xs,
        paddingLeft: SPACING.sm,
    },
});
