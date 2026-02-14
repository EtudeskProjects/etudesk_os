import React, { useCallback, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';
import { ScrollToInputContext } from '../../contexts/ScrollToInputContext';

type Props = ScrollViewProps & {
  extraScrollOffset?: number;
  keyboardVerticalOffset?: number;
  afterScrollChildren?: React.ReactNode;
};

export function KeyboardAwareScrollView({
  extraScrollOffset = 96,
  keyboardVerticalOffset = 0,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode,
  afterScrollChildren,
  ...props
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = useCallback(
    (targetNodeHandle: number, offset = extraScrollOffset) => {
      const sv = scrollRef.current;
      if (!sv) return;
      const delay = Platform.OS === 'android' ? 120 : 0;
      setTimeout(() => {
        sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, offset, true);
      }, delay);
    },
    [extraScrollOffset]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollToInputContext.Provider value={scrollToInput}>
        <>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            keyboardDismissMode={keyboardDismissMode || (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
            {...props}
          />
          {afterScrollChildren}
        </>
      </ScrollToInputContext.Provider>
    </KeyboardAvoidingView>
  );
}
