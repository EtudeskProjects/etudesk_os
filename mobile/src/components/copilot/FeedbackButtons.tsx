/**
 * FeedbackButtons — Thumbs up/down for DPO rating
 * Displayed next to CopyButton in message footer
 */

import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { ICON, SPACING } from '../../constants/theme';
import { copilotService } from '../../services/copilotService';

interface FeedbackButtonsProps {
  messageId: string;
  size?: number;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({ messageId, size = ICON.size.sm }) => {
  const { colors } = useTheme();
  const [rating, setRating] = useState<1 | 3 | null>(null);

  const handleRate = async (value: 1 | 3) => {
    if (rating === value) return;
    setRating(value);
    try {
      await copilotService.rateMessage(messageId, value);
    } catch {
      // Silent fail — rating is best-effort
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={() => handleRate(3)}
        accessibilityRole="button"
        accessibilityLabel="Bonne réponse"
      >
        <ThumbsUp
          size={size}
          color={rating === 3 ? colors.success : colors.textDisabled}
          strokeWidth={ICON.strokeWidth}
          fill={rating === 3 ? colors.success : 'none'}
        />
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => handleRate(1)}
        accessibilityRole="button"
        accessibilityLabel="Mauvaise réponse"
      >
        <ThumbsDown
          size={size}
          color={rating === 1 ? colors.error : colors.textDisabled}
          strokeWidth={ICON.strokeWidth}
          fill={rating === 1 ? colors.error : 'none'}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  button: {
    padding: 4,
  },
});

export default FeedbackButtons;
