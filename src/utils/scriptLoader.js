export const loadScript = (src, attributes = {}) => {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        existingScript.remove();
      }
  
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
  
      // Add any custom attributes
      Object.entries(attributes).forEach(([key, value]) => {
        script.setAttribute(key, value);
      });
  
      script.onload = () => resolve(script);
      script.onerror = (error) => reject(new Error(`Script load error for ${src}: ${error}`));
  
      document.head.appendChild(script);
    });
  };