import { useState, useEffect } from 'react';
import { router, navigateTo } from '../lib/router';

export function useRouter() {
  const [path, setPath] = useState(() => router.getCurrentPath());
  
  useEffect(() => {
    return router.subscribe(setPath);
  }, []);
  
  return {
    path,
    navigate: navigateTo,
  };
}