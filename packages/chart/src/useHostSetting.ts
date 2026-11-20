import { useState } from 'react';

/**
 * Holds a setting that is the hook's own, or, when the host passes `onChange`, the host's, to which each change is
 * reported; `fallback` stands in for an undefined host value and starts the hook's own.
 */
export function useHostSetting<T>(
  hostValue: T | undefined,
  onChange: ((value: T) => void) | undefined,
  fallback: T,
): [T, (value: T) => void] {
  const [ownValue, setOwnValue] = useState(fallback);
  const value = onChange === undefined ? ownValue : (hostValue ?? fallback);
  return [value, onChange ?? setOwnValue];
}
