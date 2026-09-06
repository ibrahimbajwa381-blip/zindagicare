import React from "react";
import { Text } from "react-native";

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
  setParams: jest.fn(),
  navigate: jest.fn(),
};

export const useRouter = jest.fn(() => router);
export const useLocalSearchParams = jest.fn(() => ({}) as Record<string, string>);
export const useGlobalSearchParams = jest.fn(() => ({}) as Record<string, string>);
export const useSegments = jest.fn(() => [] as string[]);
export const usePathname = jest.fn(() => "/");
export const useNavigation = jest.fn(() => ({
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
}));
export const useFocusEffect = (effect: () => void | (() => void)) => {
  // Real expo-router/react-navigation re-runs the effect whenever the callback's
  // identity changes while the screen is focused (not just on mount) — mirror
  // that here so screens using useCallback deps (e.g. a tab key) reload in tests.
  React.useEffect(effect, [effect]);
};

export function Link({
  href,
  children,
  onPress,
  testID,
  asChild,
  ...rest
}: any) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onPress: (e: unknown) => {
        onPress?.(e);
        router.push(href);
      },
      testID,
    });
  }
  return (
    <Text
      testID={testID}
      onPress={(e: unknown) => {
        onPress?.(e);
        router.push(href);
      }}
      {...rest}
    >
      {children}
    </Text>
  );
}

function ScreenStub() {
  return null;
}

function StackComponent({ children }: { children?: React.ReactNode }) {
  return <>{children ?? null}</>;
}
StackComponent.Screen = ScreenStub;
export const Stack = StackComponent;

function TabsComponent({ children }: { children?: React.ReactNode }) {
  return <>{children ?? null}</>;
}
TabsComponent.Screen = ScreenStub;
export const Tabs = TabsComponent;

export function Redirect({ href }: { href: string }) {
  React.useEffect(() => {
    router.replace(href);
  }, [href]);
  return null;
}

export const Slot = ({ children }: { children?: React.ReactNode }) => <>{children ?? null}</>;
