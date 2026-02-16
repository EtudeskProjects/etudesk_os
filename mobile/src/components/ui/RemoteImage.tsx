import React, { useMemo } from 'react';
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
  const fullUri = useMemo(() => getFullImageUrl(uri || undefined), [uri]);
  const flat = StyleSheet.flatten(style) || {};

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

  return <Image source={{ uri: fullUri }} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  svgContainer: {
    overflow: 'hidden',
  },
});

