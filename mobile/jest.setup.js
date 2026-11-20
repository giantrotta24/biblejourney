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
