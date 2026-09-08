import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getItem, setItem, removeItem, StorageKeys } from '../services/storage';

interface OnboardingContextValue {
  isComplete: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    getItem<string>(StorageKeys.OnboardingComplete).then((value) => {
      setIsComplete(value === 'true');
    });
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isComplete,
      async completeOnboarding() {
        await setItem(StorageKeys.OnboardingComplete, 'true');
        setIsComplete(true);
      },
      async resetOnboarding() {
        await removeItem(StorageKeys.OnboardingComplete);
        setIsComplete(false);
      },
    }),
    [isComplete],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding debe usarse dentro de OnboardingProvider');
  }
  return ctx;
}
