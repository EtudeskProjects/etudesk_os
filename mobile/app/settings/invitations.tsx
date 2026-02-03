/**
 * Invitations Screen
 * Shows pending invitations for the current user
 * Tab 1: Offres - Communities, Opportunities, and Spaces invitations (unified)
 * Tab 2: Organisations - Organization invitations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Building2,
  Check,
  X,
  Clock,
  Users,
  Mail,
  Lock,
  Globe,
  CreditCard,
  Briefcase,
  MapPin,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { PageLayout, EmptyState } from '../../src/components/ui';
import { invitationService, ReceivedInvitation } from '../../src/services/invitationService';
import {
  communityInvitationService,
  CommunityInvitation
} from '../../src/services/communityInvitationService';
import {
  opportunityInvitationService,
  OpportunityInvitation
} from '../../src/services/opportunityInvitationService';
import {
  spaceInvitationService,
  SpaceInvitation
} from '../../src/services/spaceInvitationService';
import { ORGANIZATION_ROLE_LABELS } from '../../src/types/models';
import { getFullImageUrl } from '../../src/utils/image';

type TabType = 'organizations' | 'offers';

type OfferInvitation =
  | (CommunityInvitation & { _type: 'community' })
  | (OpportunityInvitation & { _type: 'opportunity' })
  | (SpaceInvitation & { _type: 'space' });

export default function InvitationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('offers');

  const [orgInvitations, setOrgInvitations] = useState<ReceivedInvitation[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);

  const [communityInvitations, setCommunityInvitations] = useState<CommunityInvitation[]>([]);
  const [opportunityInvitations, setOpportunityInvitations] = useState<OpportunityInvitation[]>([]);
  const [spaceInvitations, setSpaceInvitations] = useState<SpaceInvitation[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOrgInvitations = useCallback(async () => {
    try {
      const response = await invitationService.getReceivedInvitations();
      if (response.data) {
        setOrgInvitations(response.data);
      }
    } catch (error) {
      console.error('Error fetching org invitations:', error);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  const fetchOfferInvitations = useCallback(async () => {
    try {
      const [communityRes, opportunityRes, spaceRes] = await Promise.all([
        communityInvitationService.getMyInvitations({ status: 'PENDING' }),
        opportunityInvitationService.getMyInvitations(),
        spaceInvitationService.getMyInvitations(),
      ]);

      if (communityRes.data?.data) {
        setCommunityInvitations(communityRes.data.data);
      }
      if (opportunityRes.data?.data) {
        setOpportunityInvitations(opportunityRes.data.data);
      }
      if (spaceRes.data?.data) {
        setSpaceInvitations(spaceRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching offer invitations:', error);
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgInvitations();
    fetchOfferInvitations();
  }, [fetchOrgInvitations, fetchOfferInvitations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    Promise.all([fetchOrgInvitations(), fetchOfferInvitations()])
      .finally(() => setIsRefreshing(false));
  };

  const allOfferInvitations: OfferInvitation[] = [
    ...communityInvitations.map(inv => ({ ...inv, _type: 'community' as const })),
    ...opportunityInvitations.map(inv => ({ ...inv, _type: 'opportunity' as const })),
    ...spaceInvitations.map(inv => ({ ...inv, _type: 'space' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Organization invitation handlers
  const handleAcceptOrg = async (invitation: ReceivedInvitation) => {
    setProcessingId(invitation.id);
    try {
      const response = await invitationService.acceptInvitation(invitation.id);
      if (response.success) {
        Alert.alert(
          'Invitation acceptee',
          `Vous etes maintenant membre de ${invitation.organization_name}`,
          [{ text: 'OK' }]
        );
        setOrgInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineOrg = async (invitation: ReceivedInvitation) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Voulez-vous vraiment refuser l'invitation de ${invitation.organization_name}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await invitationService.declineInvitation(invitation.id);
              setOrgInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Community invitation handlers
  const handleAcceptCommunity = async (invitation: CommunityInvitation) => {
    setProcessingId(invitation.id);
    try {
      const response = await communityInvitationService.acceptInvitation(invitation.id);
      if (response.data?.requires_payment) {
        Alert.alert(
          'Abonnement requis',
          `Cette communaute necessite un abonnement de ${response.data.monthly_price} ${response.data.currency}/mois.`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Continuer',
              onPress: () => {
                router.push(`/details/community/join/${response.data?.community_id}` as any);
              },
            },
          ]
        );
      } else if (response.data?.success) {
        Alert.alert(
          'Bienvenue !',
          response.data.message || `Vous avez rejoint la communaute !`,
          [
            {
              text: 'Voir la communaute',
              onPress: () => router.push(`/details/community/${response.data?.community_id}` as any),
            },
            { text: 'OK' },
          ]
        );
        setCommunityInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineCommunity = async (invitation: CommunityInvitation) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Voulez-vous vraiment refuser l'invitation a rejoindre "${invitation.community_name}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await communityInvitationService.declineInvitation(invitation.id);
              setCommunityInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Opportunity invitation handlers
  const handleAcceptOpportunity = async (invitation: OpportunityInvitation) => {
    setProcessingId(invitation.id);
    try {
      const response = await opportunityInvitationService.acceptInvitation(invitation.id);
      if (response.data?.success) {
        Alert.alert(
          'Invitation acceptee',
          response.data.message || `Vous pouvez maintenant voir cette opportunite !`,
          [
            {
              text: 'Voir l\'opportunite',
              onPress: () => router.push(`/details/opportunity/${response.data?.opportunity_id}` as any),
            },
            { text: 'OK' },
          ]
        );
        setOpportunityInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineOpportunity = async (invitation: OpportunityInvitation) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Voulez-vous vraiment refuser l'invitation pour "${invitation.opportunity_title}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await opportunityInvitationService.declineInvitation(invitation.id);
              setOpportunityInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  // Space invitation handlers
  const handleAcceptSpace = async (invitation: SpaceInvitation) => {
    setProcessingId(invitation.id);
    try {
      const response = await spaceInvitationService.acceptInvitation(invitation.id);
      if (response.data?.success) {
        Alert.alert(
          'Invitation acceptee',
          response.data.message || `Vous pouvez maintenant reserver cet espace !`,
          [
            {
              text: 'Voir l\'espace',
              onPress: () => router.push(`/details/space/${response.data?.space_id}` as any),
            },
            { text: 'OK' },
          ]
        );
        setSpaceInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineSpace = async (invitation: SpaceInvitation) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Voulez-vous vraiment refuser l'invitation pour "${invitation.space_name}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await spaceInvitationService.declineInvitation(invitation.id);
              setSpaceInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getExpiresIn = (dateString: string) => {
    const expires = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expiree';
    if (diffDays === 1) return 'Expire demain';
    return `Expire dans ${diffDays} jours`;
  };

  const isLoading = activeTab === 'organizations' ? orgLoading : offersLoading;
  const totalOffersCount = allOfferInvitations.length;

  const chips = [
    { key: 'offers' as TabType, label: 'Offres', count: totalOffersCount },
    { key: 'organizations' as TabType, label: 'Organisations', count: orgInvitations.length },
  ];

  const renderOrgInvitationCard = (invitation: ReceivedInvitation) => {
    const isProcessing = processingId === invitation.id;
    const roleLabel = ORGANIZATION_ROLE_LABELS[invitation.role] || invitation.role;

    return (
      <View
        key={invitation.id}
        style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      >
        <View style={styles.cardHeader}>
          {invitation.organization_logo ? (
            <Image
              source={{ uri: getFullImageUrl(invitation.organization_logo) || '' }}
              style={styles.cardLogo}
            />
          ) : (
            <View style={[styles.cardLogoPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
              <Building2 size={24} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]}>
              {invitation.organization_name}
            </Text>
            {invitation.organization_type && (
              <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                {invitation.organization_type}
              </Text>
            )}
          </View>
          <View style={[styles.typeBadge, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}>
            <Building2 size={12} color={colors.info} />
            <Text style={[styles.typeBadgeText, { color: colors.info }]}>Organisation</Text>
          </View>
        </View>

        <View style={[styles.detailsSection, { borderTopColor: colors.borderColor }]}>
          <View style={styles.detailRow}>
            <Users size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textPrimary }]}>
              Role: <Text style={{ fontWeight: '600' }}>{roleLabel}</Text>
            </Text>
          </View>

          {invitation.invited_by_name && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                Invite par {invitation.invited_by_name}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Clock size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {getExpiresIn(invitation.expires_at)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: colors.error }]}
            onPress={() => handleDeclineOrg(invitation)}
            disabled={isProcessing}
          >
            <X size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.declineText, { color: colors.error }]}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={() => handleAcceptOrg(invitation)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Check size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                <Text style={[styles.acceptText, { color: colors.textOnPrimary }]}>Accepter</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOfferInvitationCard = (invitation: OfferInvitation) => {
    const isProcessing = processingId === invitation.id;

    if (invitation._type === 'community') {
      const inv = invitation as CommunityInvitation & { _type: 'community' };
      const isPrivate = inv.access_type === 'PRIVATE' || inv.access_type === 'MEMBERSHIP';

      return (
        <View
          key={`community-${inv.id}`}
          style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        >
          <View style={styles.cardHeader}>
            {inv.cover_image_url ? (
              <Image
                source={{ uri: getFullImageUrl(inv.cover_image_url) || '' }}
                style={styles.cardLogo}
              />
            ) : (
              <View style={[styles.cardLogoPlaceholder, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
                <Users size={24} color={colors.success} strokeWidth={ICON.strokeWidth} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
                {inv.community_name}
              </Text>
              {inv.organization?.name && (
                <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                  par {inv.organization.name}
                </Text>
              )}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
              <Users size={12} color={colors.success} />
              <Text style={[styles.typeBadgeText, { color: colors.success }]}>Communaute</Text>
            </View>
          </View>

          {inv.community_description && (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {inv.community_description}
            </Text>
          )}

          {inv.message && (
            <View style={[styles.messageBox, { backgroundColor: colors.gray100 }]}>
              <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
                Message de {inv.invited_by_name}:
              </Text>
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>
                "{inv.message}"
              </Text>
            </View>
          )}

          <View style={[styles.detailsSection, { borderTopColor: colors.borderColor }]}>
            <View style={styles.detailsRow}>
              <View style={styles.detailRow}>
                {isPrivate ? (
                  <Lock size={14} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                ) : (
                  <Globe size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
                )}
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {isPrivate ? 'Privee' : 'Publique'}
                </Text>
              </View>

              {inv.members_count !== undefined && (
                <View style={styles.detailRow}>
                  <Users size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {inv.members_count} membres
                  </Text>
                </View>
              )}

              {inv.is_paid && (
                <View style={styles.detailRow}>
                  <CreditCard size={14} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.warning }]}>
                    {inv.monthly_price} {inv.currency}/mois
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.detailRow}>
              <Clock size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {getExpiresIn(inv.expires_at)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.declineButton, { borderColor: colors.error }]}
              onPress={() => handleDeclineCommunity(inv)}
              disabled={isProcessing}
            >
              <X size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.declineText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: colors.primary }]}
              onPress={() => handleAcceptCommunity(inv)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Check size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.acceptText, { color: colors.textOnPrimary }]}>
                    {inv.is_paid ? 'Rejoindre (payant)' : 'Accepter'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (invitation._type === 'opportunity') {
      const inv = invitation as OpportunityInvitation & { _type: 'opportunity' };

      return (
        <View
          key={`opportunity-${inv.id}`}
          style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        >
          <View style={styles.cardHeader}>
            {inv.cover_image_url ? (
              <Image
                source={{ uri: getFullImageUrl(inv.cover_image_url) || '' }}
                style={styles.cardLogo}
              />
            ) : (
              <View style={[styles.cardLogoPlaceholder, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
                <Briefcase size={24} color={colors.warning} strokeWidth={ICON.strokeWidth} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
                {inv.opportunity_title}
              </Text>
              {inv.organization?.name && (
                <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                  par {inv.organization.name}
                </Text>
              )}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
              <Briefcase size={12} color={colors.warning} />
              <Text style={[styles.typeBadgeText, { color: colors.warning }]}>Opportunite</Text>
            </View>
          </View>

          {inv.opportunity_summary && (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {inv.opportunity_summary}
            </Text>
          )}

          {inv.message && (
            <View style={[styles.messageBox, { backgroundColor: colors.gray100 }]}>
              <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
                Message de {inv.invited_by_name}:
              </Text>
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>
                "{inv.message}"
              </Text>
            </View>
          )}

          <View style={[styles.detailsSection, { borderTopColor: colors.borderColor }]}>
            <View style={styles.detailsRow}>
              {inv.opportunity_type && (
                <View style={styles.detailRow}>
                  <Briefcase size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {inv.opportunity_type}
                  </Text>
                </View>
              )}

              {inv.location_type && (
                <View style={styles.detailRow}>
                  <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {inv.location_type}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.detailRow}>
              <Clock size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {getExpiresIn(inv.expires_at)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.declineButton, { borderColor: colors.error }]}
              onPress={() => handleDeclineOpportunity(inv)}
              disabled={isProcessing}
            >
              <X size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.declineText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: colors.primary }]}
              onPress={() => handleAcceptOpportunity(inv)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Check size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.acceptText, { color: colors.textOnPrimary }]}>Accepter</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (invitation._type === 'space') {
      const inv = invitation as SpaceInvitation & { _type: 'space' };

      return (
        <View
          key={`space-${inv.id}`}
          style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        >
          <View style={styles.cardHeader}>
            {inv.cover_image_url ? (
              <Image
                source={{ uri: getFullImageUrl(inv.cover_image_url) || '' }}
                style={styles.cardLogo}
              />
            ) : (
              <View style={[styles.cardLogoPlaceholder, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}>
                <MapPin size={24} color={colors.info} strokeWidth={ICON.strokeWidth} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
                {inv.space_name}
              </Text>
              {inv.organization?.name && (
                <Text style={[styles.cardSubtext, { color: colors.textSecondary }]}>
                  par {inv.organization.name}
                </Text>
              )}
            </View>
            <View style={[styles.typeBadge, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}>
              <MapPin size={12} color={colors.info} />
              <Text style={[styles.typeBadgeText, { color: colors.info }]}>Espace</Text>
            </View>
          </View>

          {inv.space_description && (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {inv.space_description}
            </Text>
          )}

          {inv.message && (
            <View style={[styles.messageBox, { backgroundColor: colors.gray100 }]}>
              <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
                Message de {inv.invited_by_name}:
              </Text>
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>
                "{inv.message}"
              </Text>
            </View>
          )}

          <View style={[styles.detailsSection, { borderTopColor: colors.borderColor }]}>
            <View style={styles.detailsRow}>
              {inv.space_type && (
                <View style={styles.detailRow}>
                  <Building2 size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {inv.space_type}
                  </Text>
                </View>
              )}

              {inv.city && (
                <View style={styles.detailRow}>
                  <MapPin size={14} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {inv.city}
                  </Text>
                </View>
              )}

              {inv.hourly_rate && (
                <View style={styles.detailRow}>
                  <CreditCard size={14} color={colors.success} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.detailText, { color: colors.success }]}>
                    {inv.hourly_rate} FCFA/h
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.detailRow}>
              <Clock size={14} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {getExpiresIn(inv.expires_at)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.declineButton, { borderColor: colors.error }]}
              onPress={() => handleDeclineSpace(inv)}
              disabled={isProcessing}
            >
              <X size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.declineText, { color: colors.error }]}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: colors.primary }]}
              onPress={() => handleAcceptSpace(inv)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Check size={18} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.acceptText, { color: colors.textOnPrimary }]}>Accepter</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  const isEmpty = activeTab === 'organizations' ? orgInvitations.length === 0 : totalOffersCount === 0;

  const headerContent = (
    <View style={[styles.filtersContainer, { borderBottomColor: colors.gray200 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      >
        {chips.map((chip) => {
          const isActive = activeTab === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                { backgroundColor: colors.gray100, borderColor: colors.gray200 },
                isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setActiveTab(chip.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.gray700 },
                  isActive && { color: colors.textOnPrimary },
                ]}
              >
                {chip.label} ({chip.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <PageLayout
      title="Invitations"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      headerContent={headerContent}
    >
      {isEmpty ? (
        <EmptyState
          icon={Mail}
          title="Aucune invitation"
          subtitle={
            activeTab === 'offers'
              ? "Vous n'avez pas d'invitation pour des offres."
              : "Vous n'avez pas d'invitation à rejoindre une organisation."
          }
        />
      ) : (
        <>
          <Text style={[styles.sectionInfo, { color: colors.textSecondary }]}>
            {activeTab === 'organizations'
              ? `${orgInvitations.length} invitation${orgInvitations.length > 1 ? 's' : ''} en attente`
              : `${totalOffersCount} invitation${totalOffersCount > 1 ? 's' : ''} en attente`
            }
          </Text>

          {activeTab === 'organizations'
            ? orgInvitations.map(renderOrgInvitationCard)
            : allOfferInvitations.map(renderOfferInvitationCard)
          }
        </>
      )}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },
  filterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  sectionInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },

  invitationCard: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },

  cardLogo: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
  },

  cardLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardInfo: { flex: 1 },

  cardName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  cardSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BORDER.radius.xs,
  },

  typeBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  description: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  messageBox: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  messageLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 4,
  },

  messageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  detailsSection: {
    padding: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    gap: SPACING.sm,
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  detailText: { fontSize: TYPOGRAPHY.fontSize.sm },

  actions: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },

  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  declineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  acceptText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
