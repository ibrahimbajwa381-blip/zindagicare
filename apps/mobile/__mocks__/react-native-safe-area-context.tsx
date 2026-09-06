import React from "react";

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const frame = { x: 0, y: 0, width: 320, height: 640 };

export const SafeAreaProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SafeAreaConsumer = ({ children }: { children: (v: typeof insets) => React.ReactNode }) => (
  <>{children(insets)}</>
);
export const SafeAreaView = ({ children, ...rest }: any) => React.createElement("SafeAreaView", rest, children);
export const useSafeAreaInsets = jest.fn(() => insets);
export const useSafeAreaFrame = jest.fn(() => frame);
export const initialWindowMetrics = { insets, frame };
