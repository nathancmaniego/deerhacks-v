import { useColorScheme as useColorSchemeCore } from 'react-native';

/**
 * Wraps React Native's useColorScheme to guarantee a non-null return of 'light' | 'dark'.
 * Falls back to 'light' when the system returns null, undefined, or 'unspecified'.
 */
export const useColorScheme = (): 'light' | 'dark' => {
  const coreScheme = useColorSchemeCore();
  if (coreScheme === 'dark') return 'dark';
  return 'light';
};
