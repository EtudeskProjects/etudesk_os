/**
 * Global brand-font enforcement for <Text> and <TextInput>.
 *
 * Problem this solves (design system harmonization):
 * - The brand font is Montserrat, but the codebase historically drove weight
 *   through `fontWeight` (400/500/600/700...) WITHOUT setting a `fontFamily`.
 * - With custom fonts, React Native ignores `fontWeight` and falls back to the
 *   system font. Result before this patch: ~100% of screens rendered in the OS
 *   font, and weights were inconsistent from one screen to the next.
 *
 * Fix: patch the render of Text/TextInput once at startup so that EVERY text
 * node gets a Montserrat family resolved from its `fontWeight`. An explicit
 * `fontFamily` in the style always wins, so components that already opt into the
 * design tokens keep their exact weight.
 *
 * This is a single, contained patch instead of editing 800+ style declarations.
 */
import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

// Maps a CSS-style weight to the matching loaded Montserrat file.
// Only 400/500/600/700 are bundled (see app/_layout.tsx), so heavier weights
// collapse onto 700 Bold rather than silently falling back to the system font.
const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'Montserrat_400Regular',
  '200': 'Montserrat_400Regular',
  '300': 'Montserrat_400Regular',
  '400': 'Montserrat_400Regular',
  '500': 'Montserrat_500Medium',
  '600': 'Montserrat_600SemiBold',
  '700': 'Montserrat_700Bold',
  '800': 'Montserrat_700Bold',
  '900': 'Montserrat_700Bold',
  normal: 'Montserrat_400Regular',
  bold: 'Montserrat_700Bold',
};

const DEFAULT_FAMILY = 'Montserrat_400Regular';

function resolveFamily(style: unknown): string {
  const flat = (StyleSheet.flatten(style as never) || {}) as {
    fontFamily?: string;
    fontWeight?: string | number;
  };
  // Explicit brand family already chosen by the component -> respect it.
  if (flat.fontFamily) return flat.fontFamily;
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : 'normal';
  return WEIGHT_TO_FAMILY[weight] || DEFAULT_FAMILY;
}

let patched = false;

export function applyDefaultFont(): void {
  if (patched) return;
  patched = true;

  for (const Component of [Text, TextInput] as Array<{ render?: (...args: unknown[]) => React.ReactElement }>) {
    const original = Component.render;
    if (typeof original !== 'function') continue;

    Component.render = function patchedRender(...args: unknown[]) {
      const element = original.apply(this, args);
      if (!element || !React.isValidElement(element)) return element;
      const style = (element.props as { style?: unknown }).style;
      const fontFamily = resolveFamily(style);
      // Prepend the resolved family so any explicit style still wins on merge.
      return React.cloneElement(element as React.ReactElement<{ style?: unknown }>, {
        style: [{ fontFamily }, style],
      });
    };
  }
}
