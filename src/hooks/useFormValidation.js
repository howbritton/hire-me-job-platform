import { useState, useCallback } from 'react';

export const useFormValidation = (initialState, validationFunction) => {
  const [data, setData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const validationErrors = validationFunction({ ...data, [field]: value });
      setErrors(prev => ({ ...prev, [field]: validationErrors?.[field] }));
    }
  }, [data, touched, validationFunction]);

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const validationErrors = validationFunction(data);
    setErrors(prev => ({ ...prev, [field]: validationErrors?.[field] }));
  }, [data, validationFunction]);

  const validate = useCallback(() => {
    const validationErrors = validationFunction(data);
    setErrors(validationErrors || {});
    return !validationErrors;
  }, [data, validationFunction]);

  const reset = useCallback(() => {
    setData(initialState);
    setErrors({});
    setTouched({});
  }, [initialState]);

  return {
    data,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset
  };
};