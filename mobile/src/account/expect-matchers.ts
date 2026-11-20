import type { JestNativeMatchers } from '@testing-library/react-native/dist/matchers/types';

// expo-router's testing library augments the `expect` package. That package's matchers
// do not include the React Native ones, so a file that imports the testing library
// drops `toBeOnTheScreen` and the rest from the type checker.
declare module 'expect' {
  // The merge is the whole point: this interface adds the React Native matchers.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void>> extends JestNativeMatchers<R> {}
}
