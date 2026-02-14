import React, { createContext, useContext } from 'react';

export type ScrollToInputFn = (targetNodeHandle: number, extraOffset?: number) => void;

export const ScrollToInputContext = createContext<ScrollToInputFn | null>(null);

export function useScrollToInput() {
  return useContext(ScrollToInputContext);
}

