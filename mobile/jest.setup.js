jest.mock('react-native-worklets', () => ({
  isWorkletRuntime: () => false,
  scheduleOnRN: () => {},
  scheduleOnUI: () => {},
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (value) => value;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: identity },
    Easing: { out: identity, cubic: identity, linear: identity },
    useSharedValue: (value) => ({ value, _isReanimatedSharedValue: true }),
    useAnimatedStyle: (updater) => updater(),
    useAnimatedRef: () => ({ current: null }),
    useReducedMotion: () => false,
    interpolate: (value) => value,
    withSpring: (value, _config, callback) => {
      callback?.(true);
      return value;
    },
    measure: () => null,
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    withTiming: jest.fn((value, _config, callback) => {
      callback?.(true);
      return value;
    }),
    runOnJS: (fn) => fn,
    createAnimatedComponent: identity,
    isSharedValue: (value) => Boolean(value && value._isReanimatedSharedValue),
    useHandler: () => ({ doDependenciesDiffer: false, context: {} }),
    useEvent: () => () => {},
    useComposedEventHandler: () => () => {},
    setGestureState: () => {},
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
require('react-native-gesture-handler/jestSetup');
jest.mock('expo-apple-authentication', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  function AppleAuthenticationButton({ onPress }) {
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: 'Continue with Apple', onPress },
      React.createElement(Text, null, 'Continue with Apple'),
    );
  }
  return {
    __esModule: true,
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1, SIGN_IN: 0, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0, WHITE_OUTLINE: 1 },
    AppleAuthenticationButton,
  };
});
jest.mock('expo-crypto', () => ({
  __esModule: true,
  getRandomBytesAsync: jest.fn(async () => Uint8Array.of(1, 2, 255)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
}));
