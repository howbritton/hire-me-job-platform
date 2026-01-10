import { useEffect, useRef } from 'react';

export const useAutosave = (data, saveFunction, delay = 2000) => {
  const timeoutRef = useRef(null);
  const savedDataRef = useRef(JSON.stringify(data));

  useEffect(() => {
    // Only trigger autosave if data has actually changed
    if (JSON.stringify(data) === savedDataRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveFunction(data);
      savedDataRef.current = JSON.stringify(data);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, delay]);
};