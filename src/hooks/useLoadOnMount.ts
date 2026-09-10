import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoadOnMount<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<T | null>;
}

export function useLoadOnMount<T>(
  loader: () => Promise<T | null>,
  deps: unknown[] = [],
): LoadOnMount<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const mounted = useRef(true);

  const reload = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (mounted.current) {
        setData(result);
      }
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
      if (mounted.current) {
        setError(message);
      }
      return null;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, deps);

  return { data, loading, error, reload };
}