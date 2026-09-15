import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getTutorialCompleted, setTutorialCompleted } from '../services/storage';
import { useAuth } from './AuthContext';

interface TutorialContextValue {
  hasSeenTutorial: boolean;
  completeTutorial: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

  // Clave por usuario: si el usuario B inicia sesión en el mismo dispositivo
  // después de que el usuario A completó el tutorial, a B se le vuelve a
  // mostrar. Al cerrar sesión se resetea el estado local.
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) {
      setHasSeenTutorial(false);
      return;
    }
    let cancelled = false;
    getTutorialCompleted(userId, 'onboarding').then((done) => {
      if (!cancelled) setHasSeenTutorial(done);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      hasSeenTutorial,
      async completeTutorial() {
        if (userId !== null) {
          await setTutorialCompleted(userId, 'onboarding');
        }
        setHasSeenTutorial(true);
      },
    }),
    [hasSeenTutorial, userId],
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