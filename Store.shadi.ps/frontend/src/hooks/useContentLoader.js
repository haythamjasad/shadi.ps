import { useState, useCallback, useEffect } from 'react';

const sharedCachedData = {};

/**
 * @typedef {Object} LoadingStates
 * @property {boolean} banners - Loading state for banners
 * @property {boolean} products - Loading state for products
 * @property {boolean} images - Loading state for images
 * @property {boolean} auth - Loading state for authentication
 */

/**
 * @typedef {Object} UseContentLoaderReturn
 * @property {boolean} isLoading - Overall loading state
 * @property {number} loadingProgress - Progress percentage (0-100)
 * @property {LoadingStates} loadingStates - Individual content type states
 * @property {Array<Error>} errors - Any loading errors
 * @property {Function} markAuthLoaded - Function to mark authentication as complete
 * @property {Function} getCachedData - Function to get preloaded data
 * @property {Function} forceComplete - Function for emergency completion of loading
 */

/**
 * Custom hook to manage content loading states and data preloading.
 * This is a placeholder implementation and will need to be fully developed.
 * 
 * @returns {UseContentLoaderReturn} The content loader state and functions.
 */
const useContentLoader = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStates, setLoadingStates] = useState({
    banners: false,
    products: false,
    images: false,
    auth: true,
  });
  const [errors] = useState([]);
  const [cachedData, setCachedDataState] = useState(sharedCachedData);

  const loadingProgress = Object.values(loadingStates).filter((state) => !state).length / Object.keys(loadingStates).length * 100;

  const markAuthLoaded = useCallback(() => {
    setLoadingStates(prevStates => ({ ...prevStates, auth: false }));
  }, []);

  const getCachedData = useCallback((key) => {
    return cachedData[key];
  }, [cachedData]);

  const setCachedData = useCallback((value) => {
    const nextValue = typeof value === 'function'
      ? value(sharedCachedData)
      : value;
    if (!nextValue || typeof nextValue !== 'object') return;
    Object.assign(sharedCachedData, nextValue);
    setCachedDataState({ ...sharedCachedData });
  }, []);

  const forceComplete = useCallback(() => {
    setIsLoading(false);
    setLoadingStates({
      banners: false,
      products: false,
      images: false,
      auth: false,
    });
  }, []);

  useEffect(() => {
    setIsLoading(Object.values(loadingStates).some(Boolean));
  }, [loadingStates]);

  return {
    isLoading,
    loadingProgress,
    loadingStates,
    errors,
    markAuthLoaded,
    getCachedData,
    preloadedData: cachedData,
    forceComplete,
    setCachedData
  };
};

export { useContentLoader };
export default useContentLoader;
