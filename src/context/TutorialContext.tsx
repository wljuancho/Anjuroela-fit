import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getItem, setItem, StorageKeys } from '../services/storage';

interface TutorialContextValue {
  hasSeenTutorial: boolean;
  completeTutorial: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

  useEffect(() => {
    getItem<string>(StorageKeys.TutorialComplete).then((value) => {
      setHasSeenTutorial(value === 'true');
    });
  }, []);

  const value = useMemo<TutorialContextValue>(
    () => ({
      hasSeenTutorial,
      async completeTutorial() {
        await setItem(StorageKeys.TutorialComplete, 'true');
        setHasSeenTutorial(true);
      },
    }),
    [hasSeenTutorial],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial debe usarse dentro de TutorialProvider');
  }
  return ctx;
}