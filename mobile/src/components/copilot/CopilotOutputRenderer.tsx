/**
 * CopilotOutputRenderer
 * Renders different types of copilot output (cards, quiz, skill graph, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Users,
  MapPin,
  Building2,
  Zap,
  ChevronRight,
  BookOpen,
  Trophy,
  Target,
  CheckCircle,
  Circle,
  Clock,
  Play,
  ExternalLink,
  FileText,
  Code,
  BarChart3,
  Lightbulb,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import {
  OutputType,
  OUTPUT_TYPES,
  CopilotOutputData,
  CardListOutput,
  CopilotCard,
  QuizOutput,
  LearningPathOutput,
  SkillGraphOutput,
  FlashcardOutput,
  MiniQuizOutput,
  CodeEditorOutput,
  DiagramViewerOutput,
  ImageViewerOutput,
  YouTubePlayerOutput,
  WikipediaArticleOutput,
  ProgressReviewOutput,
  TopicOverviewOutput,
} from '../../services/copilotService';
import { TalentCard, TalentCardData } from '../cards/TalentCard';
import { OrganizationCard, OrganizationCardData } from '../cards/OrganizationCard';
import { OpportunityCard } from '../cards/OpportunityCard';
import { CommunityCard } from '../cards/CommunityCard';
import { SpaceCard } from '../cards/SpaceCard';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CopilotOutputRendererProps {
  outputType?: OutputType;
  outputData?: CopilotOutputData;
  onCardPress?: (card: CopilotCard) => void;
  onQuizAnswer?: (questionId: string, answer: string | number) => void;
  onStepPress?: (stepId: string) => void;
  onFlashcardReview?: (flashcardId: string, quality: number) => void;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const CopilotOutputRenderer: React.FC<CopilotOutputRendererProps> = ({
  outputType,
  outputData,
  onCardPress,
  onQuizAnswer,
  onStepPress,
  onFlashcardReview,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  if (!outputType || !outputData) {
    return null;
  }

  // Handle card press navigation
  const handleCardPress = (card: CopilotCard) => {
    if (onCardPress) {
      onCardPress(card);
      return;
    }

    // Default navigation based on card type
    const action = card.actions?.find((a) => a.action === 'navigate');
    if (action?.params) {
      const { screen, id, slug } = action.params as { screen?: string; id?: string; slug?: string };
      if (screen === 'opportunity' && id) {
        router.push(`/details/opportunity/${slug || id}`);
      } else if (screen === 'community' && id) {
        router.push(`/details/community/${slug || id}`);
      } else if (screen === 'space' && id) {
        router.push(`/details/space/${slug || id}`);
      } else if (screen === 'talent' && id) {
        router.push(`/details/talent/${id}`);
      } else if (screen === 'organization' && id) {
        router.push(`/details/organization/${slug || id}`);
      }
    }
  };

  // Render based on output type
  switch (outputType) {
    case OUTPUT_TYPES.CARD_LIST:
      return (
        <CardListRenderer
          data={outputData as CardListOutput}
          onCardPress={handleCardPress}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.OPPORTUNITY_LIST:
      return (
        <OpportunityListRenderer
          data={outputData as CardListOutput}
          colors={colors}
          router={router}
        />
      );

    case OUTPUT_TYPES.COMMUNITY_LIST:
      return (
        <CommunityListRenderer
          data={outputData as CardListOutput}
          colors={colors}
          router={router}
        />
      );

    case OUTPUT_TYPES.SPACE_LIST:
      return (
        <SpaceListRenderer
          data={outputData as CardListOutput}
          colors={colors}
          router={router}
        />
      );

    case OUTPUT_TYPES.ORGANIZATION_LIST:
      return (
        <OrganizationListRenderer
          data={outputData as CardListOutput}
          colors={colors}
          router={router}
        />
      );

    case OUTPUT_TYPES.FLASHCARD:
      return (
        <FlashcardRenderer
          data={outputData as FlashcardOutput}
          onReview={onFlashcardReview}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.MINI_QUIZ:
      return (
        <MiniQuizRenderer
          data={outputData as MiniQuizOutput}
          onAnswer={onQuizAnswer}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.CODE_EDITOR:
      return (
        <CodeEditorRenderer
          data={outputData as CodeEditorOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.DIAGRAM_VIEWER:
      return (
        <DiagramViewerRenderer
          data={outputData as DiagramViewerOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.IMAGE_VIEWER:
      return (
        <ImageViewerRenderer
          data={outputData as ImageViewerOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.YOUTUBE_PLAYER:
      return (
        <YouTubePlayerRenderer
          data={outputData as YouTubePlayerOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.WIKIPEDIA_ARTICLE:
      return (
        <WikipediaArticleRenderer
          data={outputData as WikipediaArticleOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.PROGRESS_REVIEW:
      return (
        <ProgressReviewRenderer
          data={outputData as ProgressReviewOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.TOPIC_OVERVIEW:
      return (
        <TopicOverviewRenderer
          data={outputData as TopicOverviewOutput}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.QUIZ:
      return (
        <QuizRenderer
          data={outputData as QuizOutput}
          onAnswer={onQuizAnswer}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.LEARNING_PATH:
      return (
        <LearningPathRenderer
          data={outputData as LearningPathOutput}
          onStepPress={onStepPress}
          colors={colors}
        />
      );

    case OUTPUT_TYPES.SKILL_GRAPH:
      return (
        <SkillGraphRenderer
          data={outputData as SkillGraphOutput}
          colors={colors}
        />
      );

    default:
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// CARD LIST RENDERER (Generic)
// ═══════════════════════════════════════════════════════════════

interface CardListRendererProps {
  data: CardListOutput;
  onCardPress: (card: CopilotCard) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const CardListRenderer: React.FC<CardListRendererProps> = ({ data, onCardPress, colors }) => {
  const getCardIcon = (type: CopilotCard['type']) => {
    switch (type) {
      case 'opportunity':
        return Briefcase;
      case 'community':
        return Users;
      case 'space':
        return MapPin;
      case 'organization':
        return Building2;
      case 'skill':
        return Zap;
      default:
        return Briefcase;
    }
  };

  return (
    <View style={styles.cardListContainer}>
      {data.cards.map((card) => {
        const CardIcon = getCardIcon(card.type);

        return (
          <TouchableOpacity
            key={card.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderColor,
              },
            ]}
            onPress={() => onCardPress(card)}
            activeOpacity={0.7}
          >
            {/* Card Image or Icon */}
            <View style={styles.cardImageContainer}>
              {card.imageUrl ? (
                <Image source={{ uri: card.imageUrl }} style={styles.cardImage} />
              ) : (
                <View
                  style={[
                    styles.cardIconPlaceholder,
                    { backgroundColor: colors.primary + '15' },
                  ]}
                >
                  <CardIcon size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                </View>
              )}
            </View>

            {/* Card Content */}
            <View style={styles.cardContent}>
              <Text
                style={[styles.cardTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {card.title}
              </Text>
              {card.subtitle && (
                <Text
                  style={[styles.cardSubtitle, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {card.subtitle}
                </Text>
              )}
              {card.description && (
                <Text
                  style={[styles.cardDescription, { color: colors.textTertiary }]}
                  numberOfLines={2}
                >
                  {card.description}
                </Text>
              )}

              {/* Metadata chips */}
              {card.metadata && (
                <View style={styles.metadataContainer}>
                  {card.metadata.location && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <MapPin size={12} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
                        {String(card.metadata.location)}
                      </Text>
                    </View>
                  )}
                  {card.metadata.memberCount !== undefined && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Users size={12} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                      <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
                        {card.metadata.memberCount} membres
                      </Text>
                    </View>
                  )}
                  {card.metadata.price && (
                    <View
                      style={[
                        styles.metadataChip,
                        { backgroundColor: colors.primary + '15' },
                      ]}
                    >
                      <Text style={[styles.metadataText, { color: colors.primary }]}>
                        {String(card.metadata.price)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Arrow */}
            <ChevronRight size={ICON.size.sm} color={colors.textTertiary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        );
      })}

      {data.hasMore && (
        <Text style={[styles.hasMoreText, { color: colors.textSecondary }]}>
          + autres résultats disponibles
        </Text>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// OPPORTUNITY LIST RENDERER
// ═══════════════════════════════════════════════════════════════

interface OpportunityListRendererProps {
  data: CardListOutput;
  colors: ReturnType<typeof useTheme>['colors'];
  router: ReturnType<typeof useRouter>;
}

const OpportunityListRenderer: React.FC<OpportunityListRendererProps> = ({ data, colors, router }) => {
  return (
    <View style={styles.cardListContainer}>
      {data.cards.map((card, index) => {
        const opportunity = {
          id: card.id,
          title: card.title,
          organization: card.subtitle ? { name: card.subtitle } : undefined,
          description: card.description,
          cover_image_url: card.imageUrl,
          locations: card.metadata?.location ? [{ city: String(card.metadata.location) }] : undefined,
          contract_type: card.metadata?.contractType as string | undefined,
        };

        return (
          <OpportunityCard
            key={card.id}
            opportunity={opportunity as any}
            onPress={() => router.push(`/details/opportunity/${card.id}`)}
            isLast={index === data.cards.length - 1}
          />
        );
      })}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// COMMUNITY LIST RENDERER
// ═══════════════════════════════════════════════════════════════

interface CommunityListRendererProps {
  data: CardListOutput;
  colors: ReturnType<typeof useTheme>['colors'];
  router: ReturnType<typeof useRouter>;
}

const CommunityListRenderer: React.FC<CommunityListRendererProps> = ({ data, colors, router }) => {
  return (
    <View style={styles.cardListContainer}>
      {data.cards.map((card, index) => {
        const community = {
          id: card.id,
          name: card.title,
          description: card.description,
          cover_image_url: card.imageUrl,
          logo_url: card.imageUrl,
          member_count: card.metadata?.memberCount,
        };

        return (
          <CommunityCard
            key={card.id}
            community={community as any}
            onPress={() => router.push(`/details/community/${card.id}`)}
            isLast={index === data.cards.length - 1}
          />
        );
      })}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// SPACE LIST RENDERER
// ═══════════════════════════════════════════════════════════════

interface SpaceListRendererProps {
  data: CardListOutput;
  colors: ReturnType<typeof useTheme>['colors'];
  router: ReturnType<typeof useRouter>;
}

const SpaceListRenderer: React.FC<SpaceListRendererProps> = ({ data, colors, router }) => {
  return (
    <View style={styles.cardListContainer}>
      {data.cards.map((card, index) => {
        const space = {
          id: card.id,
          name: card.title,
          description: card.description,
          cover_image_url: card.imageUrl,
          location: card.metadata?.location ? { city: String(card.metadata.location) } : undefined,
        };

        return (
          <SpaceCard
            key={card.id}
            space={space as any}
            onPress={() => router.push(`/details/space/${card.id}`)}
            isLast={index === data.cards.length - 1}
          />
        );
      })}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// ORGANIZATION LIST RENDERER
// ═══════════════════════════════════════════════════════════════

interface OrganizationListRendererProps {
  data: CardListOutput;
  colors: ReturnType<typeof useTheme>['colors'];
  router: ReturnType<typeof useRouter>;
}

const OrganizationListRenderer: React.FC<OrganizationListRendererProps> = ({ data, colors, router }) => {
  return (
    <View style={styles.cardListContainer}>
      {data.cards.map((card) => {
        const organization: OrganizationCardData = {
          id: card.id,
          name: card.title,
          description: card.description,
          logo_url: card.imageUrl,
          city: card.metadata?.location ? String(card.metadata.location) : undefined,
          employees_count: card.metadata?.employeesCount as number | undefined,
          opportunities_count: card.metadata?.opportunitiesCount as number | undefined,
          sectors: card.metadata?.sectors as string[] | undefined,
        };

        return (
          <OrganizationCard
            key={card.id}
            organization={organization}
            onPress={() => router.push(`/details/organization/${card.id}`)}
          />
        );
      })}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// FLASHCARD RENDERER
// ═══════════════════════════════════════════════════════════════

interface FlashcardRendererProps {
  data: FlashcardOutput;
  onReview?: (flashcardId: string, quality: number) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const FlashcardRenderer: React.FC<FlashcardRendererProps> = ({ data, onReview, colors }) => {
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [answered, setAnswered] = React.useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleReview = (quality: number) => {
    setAnswered(true);
    onReview?.(data.id, quality);
  };

  return (
    <View style={[styles.flashcardContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.flashcardHeader}>
        <BookOpen size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.flashcardTopic, { color: colors.textSecondary }]}>{data.topicName}</Text>
        <View style={[styles.difficultyBadge, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.difficultyText, { color: colors.primary }]}>{data.difficulty}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.flashcardContent} onPress={handleFlip} activeOpacity={0.8}>
        <Text style={[styles.flashcardText, { color: colors.textPrimary }]}>
          {isFlipped ? data.back : data.front}
        </Text>
        {!isFlipped && data.hint && (
          <Text style={[styles.flashcardHint, { color: colors.textTertiary }]}>
            Indice: {data.hint}
          </Text>
        )}
        <Text style={[styles.flashcardTapHint, { color: colors.textTertiary }]}>
          {isFlipped ? 'Touchez pour voir la question' : 'Touchez pour voir la réponse'}
        </Text>
      </TouchableOpacity>

      {isFlipped && !answered && (
        <View style={styles.reviewButtons}>
          <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Comment était-ce ?</Text>
          <View style={styles.reviewButtonsRow}>
            <TouchableOpacity
              style={[styles.reviewButton, { backgroundColor: colors.error + '15' }]}
              onPress={() => handleReview(1)}
            >
              <Text style={[styles.reviewButtonText, { color: colors.error }]}>Difficile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reviewButton, { backgroundColor: colors.warning + '15' }]}
              onPress={() => handleReview(3)}
            >
              <Text style={[styles.reviewButtonText, { color: colors.warning }]}>Moyen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reviewButton, { backgroundColor: colors.success + '15' }]}
              onPress={() => handleReview(5)}
            >
              <Text style={[styles.reviewButtonText, { color: colors.success }]}>Facile</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// MINI QUIZ RENDERER
// ═══════════════════════════════════════════════════════════════

interface MiniQuizRendererProps {
  data: MiniQuizOutput;
  onAnswer?: (questionId: string, answer: string | number) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const MiniQuizRenderer: React.FC<MiniQuizRendererProps> = ({ data, onAnswer, colors }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [selectedAnswer, setSelectedAnswer] = React.useState<number | null>(null);
  const [showExplanation, setShowExplanation] = React.useState(false);
  const [results, setResults] = React.useState<boolean[]>([]);

  const currentQuestion = data.questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correctAnswer;
  const isComplete = currentIndex >= data.questions.length;

  const handleSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    onAnswer?.(currentQuestion.id, index);
    if (data.showExplanations) {
      setShowExplanation(true);
    }
  };

  const handleNext = () => {
    setResults([...results, isCorrect]);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCurrentIndex(currentIndex + 1);
  };

  if (isComplete) {
    const correctCount = results.filter(Boolean).length;
    return (
      <View style={[styles.quizContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <View style={styles.quizHeader}>
          <Trophy size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.quizResultTitle, { color: colors.textPrimary }]}>Quiz terminé !</Text>
          <Text style={[styles.quizResultScore, { color: colors.primary }]}>
            {correctCount}/{data.questions.length} bonnes réponses
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.quizContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.quizHeader}>
        <Text style={[styles.quizProgress, { color: colors.textSecondary }]}>
          Question {currentIndex + 1}/{data.questions.length}
        </Text>
        {data.topicName && (
          <Text style={[styles.quizTopic, { color: colors.primary }]}>{data.topicName}</Text>
        )}
      </View>

      <Text style={[styles.questionText, { color: colors.textPrimary }]}>
        {currentQuestion.question}
      </Text>

      <View style={styles.optionsContainer}>
        {currentQuestion.options?.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const showCorrect = selectedAnswer !== null && index === currentQuestion.correctAnswer;
          const showWrong = isSelected && !isCorrect;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                {
                  backgroundColor: showCorrect ? colors.success + '15' : showWrong ? colors.error + '15' : isSelected ? colors.primary + '15' : colors.background,
                  borderColor: showCorrect ? colors.success : showWrong ? colors.error : isSelected ? colors.primary : colors.borderColor,
                },
              ]}
              onPress={() => handleSelect(index)}
              disabled={selectedAnswer !== null}
            >
              <Text style={[styles.optionText, { color: showCorrect ? colors.success : showWrong ? colors.error : colors.textPrimary }]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showExplanation && currentQuestion.explanation && (
        <View style={[styles.explanationBox, { backgroundColor: colors.infoLight }]}>
          <Lightbulb size={16} color={colors.info} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.explanationText, { color: colors.info }]}>
            {currentQuestion.explanation}
          </Text>
        </View>
      )}

      {selectedAnswer !== null && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex < data.questions.length - 1 ? 'Suivant' : 'Terminer'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// CODE EDITOR RENDERER
// ═══════════════════════════════════════════════════════════════

interface CodeEditorRendererProps {
  data: CodeEditorOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const CodeEditorRenderer: React.FC<CodeEditorRendererProps> = ({ data, colors }) => {
  return (
    <View style={[styles.codeEditorContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.codeEditorHeader}>
        <Code size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.codeEditorLanguage, { color: colors.primary }]}>{data.language}</Text>
      </View>

      <Text style={[styles.codeEditorInstructions, { color: colors.textPrimary }]}>
        {data.instructions}
      </Text>

      <View style={[styles.codeBlock, { backgroundColor: colors.gray900 }]}>
        <Text style={[styles.codeText, { color: colors.gray100 }]}>
          {data.initialCode}
        </Text>
      </View>

      {data.hints && data.hints.length > 0 && (
        <View style={styles.hintsContainer}>
          <Text style={[styles.hintsTitle, { color: colors.textSecondary }]}>Indices :</Text>
          {data.hints.map((hint, index) => (
            <Text key={index} style={[styles.hintText, { color: colors.textTertiary }]}>
              {index + 1}. {hint}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// DIAGRAM VIEWER RENDERER
// ═══════════════════════════════════════════════════════════════

interface DiagramViewerRendererProps {
  data: DiagramViewerOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const DiagramViewerRenderer: React.FC<DiagramViewerRendererProps> = ({ data, colors }) => {
  return (
    <View style={[styles.diagramContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Text style={[styles.diagramTitle, { color: colors.textPrimary }]}>{data.title}</Text>
      {data.description && (
        <Text style={[styles.diagramDescription, { color: colors.textSecondary }]}>
          {data.description}
        </Text>
      )}
      <View style={[styles.diagramCode, { backgroundColor: colors.gray100, borderColor: colors.borderColor }]}>
        <Text style={[styles.diagramCodeText, { color: colors.textSecondary }]}>
          Diagramme {data.type}: Visualisation non disponible en mode texte
        </Text>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// IMAGE VIEWER RENDERER
// ═══════════════════════════════════════════════════════════════

interface ImageViewerRendererProps {
  data: ImageViewerOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const ImageViewerRenderer: React.FC<ImageViewerRendererProps> = ({ data, colors }) => {
  return (
    <View style={[styles.imageViewerContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Image source={{ uri: data.url }} style={styles.viewerImage} resizeMode="contain" />
      {data.caption && (
        <Text style={[styles.imageCaption, { color: colors.textSecondary }]}>
          {data.caption}
        </Text>
      )}
      {data.source && (
        <Text style={[styles.imageSource, { color: colors.textTertiary }]}>
          Source: {data.source}
        </Text>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// YOUTUBE PLAYER RENDERER
// ═══════════════════════════════════════════════════════════════

interface YouTubePlayerRendererProps {
  data: YouTubePlayerOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const YouTubePlayerRenderer: React.FC<YouTubePlayerRendererProps> = ({ data, colors }) => {
  const handlePress = () => {
    const url = `https://www.youtube.com/watch?v=${data.videoId}${data.startTime ? `&t=${data.startTime}` : ''}`;
    Linking.openURL(url);
  };

  return (
    <TouchableOpacity
      style={[styles.youtubeContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.youtubeThumbnail}>
        <Image
          source={{ uri: `https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg` }}
          style={styles.youtubeThumbnailImage}
        />
        <View style={styles.youtubePlayButton}>
          <Play size={32} color="#fff" fill="#fff" strokeWidth={ICON.strokeWidth} />
        </View>
      </View>
      <View style={styles.youtubeContent}>
        <Text style={[styles.youtubeTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {data.title}
        </Text>
        {data.channelName && (
          <Text style={[styles.youtubeChannel, { color: colors.textSecondary }]}>
            {data.channelName}
          </Text>
        )}
        {data.description && (
          <Text style={[styles.youtubeDescription, { color: colors.textTertiary }]} numberOfLines={2}>
            {data.description}
          </Text>
        )}
      </View>
      <ExternalLink size={ICON.size.sm} color={colors.textTertiary} strokeWidth={ICON.strokeWidth} />
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════════
// WIKIPEDIA ARTICLE RENDERER
// ═══════════════════════════════════════════════════════════════

interface WikipediaArticleRendererProps {
  data: WikipediaArticleOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const WikipediaArticleRenderer: React.FC<WikipediaArticleRendererProps> = ({ data, colors }) => {
  const handlePress = () => {
    Linking.openURL(data.url);
  };

  return (
    <TouchableOpacity
      style={[styles.wikipediaContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {data.imageUrl && (
        <Image source={{ uri: data.imageUrl }} style={styles.wikipediaImage} />
      )}
      <View style={styles.wikipediaContent}>
        <View style={styles.wikipediaHeader}>
          <FileText size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.wikipediaLabel, { color: colors.primary }]}>Wikipedia</Text>
        </View>
        <Text style={[styles.wikipediaTitle, { color: colors.textPrimary }]}>{data.title}</Text>
        <Text style={[styles.wikipediaSummary, { color: colors.textSecondary }]} numberOfLines={4}>
          {data.summary}
        </Text>
      </View>
      <ExternalLink size={ICON.size.sm} color={colors.textTertiary} strokeWidth={ICON.strokeWidth} />
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROGRESS REVIEW RENDERER
// ═══════════════════════════════════════════════════════════════

interface ProgressReviewRendererProps {
  data: ProgressReviewOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const ProgressReviewRenderer: React.FC<ProgressReviewRendererProps> = ({ data, colors }) => {
  return (
    <View style={[styles.progressContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <View style={styles.progressHeader}>
        <BarChart3 size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
          Progression {data.period === 'day' ? "du jour" : data.period === 'week' ? 'de la semaine' : data.period === 'month' ? 'du mois' : 'totale'}
        </Text>
      </View>

      <View style={styles.progressStats}>
        <View style={styles.progressStat}>
          <Text style={[styles.progressStatValue, { color: colors.primary }]}>{data.cardsReviewed}</Text>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Cartes révisées</Text>
        </View>
        <View style={styles.progressStat}>
          <Text style={[styles.progressStatValue, { color: colors.success }]}>{data.cardsLearned}</Text>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Cartes apprises</Text>
        </View>
        <View style={styles.progressStat}>
          <Text style={[styles.progressStatValue, { color: colors.warning }]}>{Math.round(data.accuracy)}%</Text>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Précision</Text>
        </View>
        <View style={styles.progressStat}>
          <Text style={[styles.progressStatValue, { color: colors.info }]}>{data.streakDays}</Text>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>Jours consécutifs</Text>
        </View>
      </View>

      {data.recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={[styles.recommendationsTitle, { color: colors.textPrimary }]}>Recommandations</Text>
          {data.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationItem}>
              <Lightbulb size={14} color={colors.warning} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>{rec}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// TOPIC OVERVIEW RENDERER
// ═══════════════════════════════════════════════════════════════

interface TopicOverviewRendererProps {
  data: TopicOverviewOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const TopicOverviewRenderer: React.FC<TopicOverviewRendererProps> = ({ data, colors }) => {
  return (
    <View style={[styles.topicContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Text style={[styles.topicName, { color: colors.textPrimary }]}>{data.name}</Text>
      {data.description && (
        <Text style={[styles.topicDescription, { color: colors.textSecondary }]}>
          {data.description}
        </Text>
      )}

      <View style={styles.topicStats}>
        <View style={styles.topicStatItem}>
          <Text style={[styles.topicStatValue, { color: colors.primary }]}>{Math.round(data.masteryLevel)}%</Text>
          <Text style={[styles.topicStatLabel, { color: colors.textSecondary }]}>Maîtrise</Text>
        </View>
        <View style={styles.topicStatItem}>
          <Text style={[styles.topicStatValue, { color: colors.textPrimary }]}>{data.totalFlashcards}</Text>
          <Text style={[styles.topicStatLabel, { color: colors.textSecondary }]}>Cartes</Text>
        </View>
        <View style={styles.topicStatItem}>
          <Text style={[styles.topicStatValue, { color: colors.warning }]}>{data.dueFlashcards}</Text>
          <Text style={[styles.topicStatLabel, { color: colors.textSecondary }]}>À réviser</Text>
        </View>
      </View>

      {data.relatedTopics.length > 0 && (
        <View style={styles.relatedTopicsContainer}>
          <Text style={[styles.relatedTopicsTitle, { color: colors.textSecondary }]}>Sujets liés</Text>
          <View style={styles.relatedTopicsList}>
            {data.relatedTopics.map((topic) => (
              <View key={topic.id} style={[styles.relatedTopicChip, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.relatedTopicText, { color: colors.textPrimary }]}>{topic.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUIZ RENDERER
// ═══════════════════════════════════════════════════════════════

interface QuizRendererProps {
  data: QuizOutput;
  onAnswer?: (questionId: string, answer: string | number) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const QuizRenderer: React.FC<QuizRendererProps> = ({ data, onAnswer, colors }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [selectedAnswers, setSelectedAnswers] = React.useState<Record<string, string | number>>({});
  const [showResult, setShowResult] = React.useState(false);

  const currentQuestion = data.questions[currentQuestionIndex];

  const handleOptionPress = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    onAnswer?.(questionId, optionIndex);
  };

  const handleNext = () => {
    if (currentQuestionIndex < data.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  if (showResult) {
    const correctCount = data.questions.filter(
      (q) => selectedAnswers[q.id] === q.correctAnswer
    ).length;

    return (
      <View style={[styles.quizContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <View style={styles.quizHeader}>
          <Trophy size={32} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.quizResultTitle, { color: colors.textPrimary }]}>
            Quiz terminé !
          </Text>
          <Text style={[styles.quizResultScore, { color: colors.primary }]}>
            {correctCount}/{data.questions.length} bonnes réponses
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.quizContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Quiz Header */}
      <View style={styles.quizHeader}>
        <BookOpen size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <Text style={[styles.quizTitle, { color: colors.textPrimary }]}>{data.title}</Text>
        <Text style={[styles.quizProgress, { color: colors.textSecondary }]}>
          Question {currentQuestionIndex + 1}/{data.questions.length}
        </Text>
      </View>

      {/* Question */}
      <Text style={[styles.questionText, { color: colors.textPrimary }]}>
        {currentQuestion.question}
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {currentQuestion.options?.map((option, index) => {
          const isSelected = selectedAnswers[currentQuestion.id] === index;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.background,
                  borderColor: isSelected ? colors.primary : colors.borderColor,
                },
              ]}
              onPress={() => handleOptionPress(currentQuestion.id, index)}
            >
              <View
                style={[
                  styles.optionRadio,
                  {
                    borderColor: isSelected ? colors.primary : colors.borderColor,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {isSelected && <View style={styles.optionRadioInner} />}
              </View>
              <Text
                style={[
                  styles.optionText,
                  { color: isSelected ? colors.primary : colors.textPrimary },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Next Button */}
      {selectedAnswers[currentQuestion.id] !== undefined && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentQuestionIndex < data.questions.length - 1 ? 'Suivant' : 'Terminer'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// LEARNING PATH RENDERER
// ═══════════════════════════════════════════════════════════════

interface LearningPathRendererProps {
  data: LearningPathOutput;
  onStepPress?: (stepId: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const LearningPathRenderer: React.FC<LearningPathRendererProps> = ({
  data,
  onStepPress,
  colors,
}) => {
  const getStepIcon = (type: string, completed?: boolean) => {
    if (completed) {
      return CheckCircle;
    }
    switch (type) {
      case 'lesson':
        return BookOpen;
      case 'quiz':
        return Target;
      case 'exercise':
      case 'project':
        return Zap;
      default:
        return Circle;
    }
  };

  return (
    <View style={[styles.learningPathContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.learningPathHeader}>
        <Target size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <View style={styles.learningPathHeaderText}>
          <Text style={[styles.learningPathTitle, { color: colors.textPrimary }]}>
            {data.title}
          </Text>
          {data.description && (
            <Text style={[styles.learningPathDescription, { color: colors.textSecondary }]}>
              {data.description}
            </Text>
          )}
        </View>
      </View>

      {/* Duration */}
      {data.estimatedDuration && (
        <View style={[styles.durationBadge, { backgroundColor: colors.primary + '15' }]}>
          <Clock size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.durationText, { color: colors.primary }]}>
            {data.estimatedDuration}h estimées
          </Text>
        </View>
      )}

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {data.steps.map((step, index) => {
          const StepIcon = getStepIcon(step.type, step.completed);
          const isLast = index === data.steps.length - 1;

          return (
            <TouchableOpacity
              key={step.id}
              style={styles.stepItem}
              onPress={() => onStepPress?.(step.id)}
              disabled={!onStepPress}
            >
              {/* Step indicator line */}
              <View style={styles.stepIndicatorContainer}>
                <View
                  style={[
                    styles.stepIcon,
                    {
                      backgroundColor: step.completed ? colors.success : colors.primary + '15',
                      borderColor: step.completed ? colors.success : colors.primary,
                    },
                  ]}
                >
                  <StepIcon
                    size={16}
                    color={step.completed ? '#fff' : colors.primary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: step.completed ? colors.success : colors.borderColor },
                    ]}
                  />
                )}
              </View>

              {/* Step content */}
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                  {step.title}
                </Text>
                <Text
                  style={[styles.stepDescription, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {step.description}
                </Text>
                {step.duration && (
                  <Text style={[styles.stepDuration, { color: colors.textTertiary }]}>
                    ~{step.duration} min
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// SKILL GRAPH RENDERER (Simplified view)
// ═══════════════════════════════════════════════════════════════

interface SkillGraphRendererProps {
  data: SkillGraphOutput;
  colors: ReturnType<typeof useTheme>['colors'];
}

const SkillGraphRenderer: React.FC<SkillGraphRendererProps> = ({ data, colors }) => {
  const focusNode = data.nodes.find((n) => n.isTarget);
  const relatedNodes = data.nodes.filter((n) => !n.isTarget);

  return (
    <View style={[styles.skillGraphContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Focus skill */}
      {focusNode && (
        <View style={styles.focusSkillContainer}>
          <View
            style={[
              styles.focusSkillBadge,
              { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Zap size={20} color="#fff" strokeWidth={ICON.strokeWidth} />
          </View>
          <Text style={[styles.focusSkillName, { color: colors.textPrimary }]}>
            {focusNode.name}
          </Text>
          {focusNode.level && (
            <Text style={[styles.focusSkillLevel, { color: colors.textSecondary }]}>
              Niveau: {focusNode.level}
            </Text>
          )}
          {focusNode.progress !== undefined && (
            <View style={styles.progressContainer}>
              <View
                style={[styles.progressBar, { backgroundColor: colors.borderColor }]}
              >
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${focusNode.progress}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {focusNode.progress}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Summary */}
      {data.summary && (
        <Text style={[styles.skillGraphSummary, { color: colors.textSecondary }]}>
          {data.summary}
        </Text>
      )}

      {/* Related skills */}
      {relatedNodes.length > 0 && (
        <View style={styles.relatedSkillsContainer}>
          <Text style={[styles.relatedSkillsTitle, { color: colors.textPrimary }]}>
            Compétences liées
          </Text>
          <View style={styles.relatedSkillsGrid}>
            {relatedNodes.slice(0, 6).map((node) => (
              <View
                key={node.id}
                style={[
                  styles.relatedSkillChip,
                  {
                    backgroundColor: node.isAcquired ? colors.success + '15' : colors.background,
                    borderColor: node.isAcquired ? colors.success : colors.borderColor,
                  },
                ]}
              >
                {node.isAcquired && (
                  <CheckCircle size={12} color={colors.success} strokeWidth={ICON.strokeWidth} />
                )}
                <Text
                  style={[
                    styles.relatedSkillText,
                    { color: node.isAcquired ? colors.success : colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {node.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // Card List
  cardListContainer: {
    marginTop: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  cardImageContainer: {
    marginRight: SPACING.md,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER.radius.md,
  },
  cardIconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BORDER.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  cardSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  cardDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  metadataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER.radius.full,
    gap: 4,
  },
  metadataText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 11,
  },
  hasMoreText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },

  // Flashcard
  flashcardContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  flashcardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  flashcardTopic: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },
  difficultyText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  flashcardContent: {
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  flashcardText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },
  flashcardHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  flashcardTapHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.lg,
  },
  reviewButtons: {
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: SPACING.lg,
  },
  reviewLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  reviewButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reviewButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Code Editor
  codeEditorContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  codeEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  codeEditorLanguage: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textTransform: 'uppercase',
  },
  codeEditorInstructions: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginBottom: SPACING.md,
  },
  codeBlock: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  hintsContainer: {
    marginTop: SPACING.sm,
  },
  hintsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },
  hintText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 4,
  },

  // Diagram
  diagramContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  diagramTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  diagramDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
  },
  diagramCode: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
  },
  diagramCodeText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Image Viewer
  imageViewerContainer: {
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  viewerImage: {
    width: '100%',
    height: 200,
  },
  imageCaption: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    padding: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  imageSource: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },

  // YouTube
  youtubeContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  youtubeThumbnail: {
    width: 120,
    height: 68,
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  youtubeThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  youtubePlayButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  youtubeContent: {
    flex: 1,
  },
  youtubeTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  youtubeChannel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  youtubeDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  // Wikipedia
  wikipediaContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
    alignItems: 'flex-start',
  },
  wikipediaImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER.radius.md,
    marginRight: SPACING.md,
  },
  wikipediaContent: {
    flex: 1,
  },
  wikipediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  wikipediaLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  wikipediaTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  wikipediaSummary: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },

  // Progress Review
  progressContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  progressTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  progressStatLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  recommendationsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: SPACING.md,
  },
  recommendationsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.sm,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  recommendationText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  // Topic Overview
  topicContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  topicName: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  topicDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },
  topicStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  topicStatItem: {
    alignItems: 'center',
  },
  topicStatValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  topicStatLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  relatedTopicsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: SPACING.md,
  },
  relatedTopicsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },
  relatedTopicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  relatedTopicChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },
  relatedTopicText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Quiz
  quizContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  quizHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  quizTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  quizProgress: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  quizTopic: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: SPACING.xs,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.lg,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    flex: 1,
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginTop: SPACING.md,
  },
  explanationText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  nextButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
  },
  nextButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: '#fff',
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  quizResultTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
  },
  quizResultScore: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.sm,
  },

  // Learning Path
  learningPathContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  learningPathHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  learningPathHeaderText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  learningPathTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  learningPathDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  durationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  stepsContainer: {
    paddingLeft: SPACING.xs,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  stepIndicatorContainer: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginTop: SPACING.xs,
    marginBottom: -SPACING.md,
  },
  stepContent: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  stepDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  stepDuration: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 11,
    marginTop: SPACING.xs,
  },

  // Skill Graph
  skillGraphContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  focusSkillContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  focusSkillBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusSkillName: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
  },
  focusSkillLevel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  skillGraphSummary: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  relatedSkillsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: SPACING.lg,
  },
  relatedSkillsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },
  relatedSkillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  relatedSkillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  relatedSkillText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default CopilotOutputRenderer;
