/**
 * CopyButton — Copy markdown content to clipboard
 */

import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { ICON } from '../../constants/theme';

interface CopyButtonProps {
  content: string;
  size?: number;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content, size = ICON.size.sm }) => {
  const [copied, setCopied] = useState(false);
  const { colors } = useTheme();

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Icon = copied ? Check : Copy;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleCopy}
      activeOpacity={0.7}
    >
      <Icon
        size={size}
        color={copied ? colors.success : colors.textSecondary}
        strokeWidth={ICON.strokeWidth}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});

export default CopyButton;
