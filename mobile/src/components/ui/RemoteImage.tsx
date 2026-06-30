import React, { useEffect, useMemo, useState } from 'react';
import { Image, type ImageProps, type ImageStyle, StyleSheet, type StyleProp, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { getFullImageUrl } from '../../utils/image';

type Props = {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageProps['resizeMode'];
};

function isSvgUrl(url: string): boolean {
  const withoutQuery = url.split('?')[0].toLowerCase();
  return withoutQuery.endsWith('.svg');
}

export function RemoteImage({ uri, style, resizeMode }: Props) {
  const flat = StyleSheet.flatten(style) || {};
  const targetWidth = typeof flat.width === 'number' ? Math.ceil(flat.width * 3) : 640;
  const fullUri = useMemo(() => getFullImageUrl(uri || undefined, { width: targetWidth, quality: 75 }), [uri, targetWidth]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [fullUri]);

  if (!fullUri) return null;

  if (isSvgUrl(fullUri)) {
    const width = typeof flat.width === 'number' ? flat.width : 40;
    const height = typeof flat.height === 'number' ? flat.height : 40;
    return (
      <View style={[style, styles.svgContainer]}>
        <SvgUri uri={fullUri} width={width} height={height} />
      </View>
    );
  }

  return (
    <View style={[style, styles.imageContainer]}>
      <Image
        key={fullUri}
        source={{ uri: fullUri, cache: 'force-cache' }}
        style={[StyleSheet.absoluteFill, !isLoaded && styles.hiddenImage]}
        resizeMode={resizeMode}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(false)}
      />
      {!isLoaded && <View style={styles.loadingOverlay} />}
    </View>
  );
}

const styles = StyleSheet.create({
  svgContainer: {
    overflow: 'hidden',
  },
  imageContainer: {
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  hiddenImage: {
    opacity: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F1F5F9',
  },
});
