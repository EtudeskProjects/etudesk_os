import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import { Briefcase } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { ICON } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageSliderProps {
  images: string[];
  height?: number;
  showPagination?: boolean;
  borderRadius?: number;
  onImagePress?: (index: number) => void;
}

export const ImageSlider: React.FC<ImageSliderProps> = ({
  images,
  height = 250,
  showPagination = true,
  borderRadius = 0,
  onImagePress,
}) => {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (currentIndex !== activeIndex && currentIndex >= 0 && currentIndex < images.length) {
      setActiveIndex(currentIndex);
    }
  };

  const handleDotPress = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
    setActiveIndex(index);
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.placeholder, { height, backgroundColor: colors.gray100, borderRadius }]}>
        <Briefcase size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      </View>
    );
  }

  if (images.length === 1) {
    return (
      <TouchableOpacity
        activeOpacity={onImagePress ? 0.9 : 1}
        onPress={() => onImagePress?.(0)}
      >
        <Image
          source={{ uri: images[0] }}
          style={[styles.image, { height, borderRadius }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { borderRadius }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={onImagePress ? 0.9 : 1}
            onPress={() => onImagePress?.(index)}
          >
            <Image
              source={{ uri: image }}
              style={[styles.image, { height, width: SCREEN_WIDTH }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showPagination && images.length > 1 && (
        <View style={styles.paginationContainer}>
          <View style={[styles.paginationWrapper, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            {images.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleDotPress(index)}
                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: index === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                      width: index === activeIndex ? 20 : 8,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  paginationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});

export default ImageSlider;
