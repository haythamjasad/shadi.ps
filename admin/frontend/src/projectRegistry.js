import { resolveApiBase } from './projectApiClient.js';

export const PROJECT_REGISTRY = {
  store: {
    key: 'store',
    label: 'Store',
    envBaseVar: 'VITE_API_BASE_URL',
    fallbackPath: '/api/v01',
    productionBase: 'https://store.shadi.ps/api/v01',
    localPort: 4000,
    localPath: '/api/v01'
  },
  shadi: {
    key: 'shadi',
    label: 'Shadi',
    envBaseVar: 'VITE_SHADI_API_BASE_URL',
    fallbackPath: '/api/v0',
    productionBase: 'https://shadi.ps/api/v0',
    localPort: 5010,
    localPath: '/api/v0'
  },
  projectX: {
    key: 'projectX',
    label: 'Project X',
    envBaseVar: 'VITE_PROJECT_X_API_BASE_URL',
    fallbackPath: '/api/project-x',
    productionBase: 'https://projectx.shadi.ps/api',
    localPort: 5180,
    localPath: '/api'
  },
  sharah: {
    key: 'sharah',
    label: 'Shara',
    envBaseVar: 'VITE_SHARAH_API_BASE_URL',
    fallbackPath: '/v01/api/sharah',
    productionBase: 'https://shara.shadi.ps/v01/api/sharah',
    localPort: 8000,
    localPath: '/v01/api/sharah'
  }
};

export function resolveProjectBase(projectKey) {
  const project = PROJECT_REGISTRY[projectKey];
  if (!project) {
    throw new Error(`Unknown project key: ${projectKey}`);
  }

  return resolveApiBase({
    envValue: import.meta.env[project.envBaseVar],
    fallbackPath: project.fallbackPath,
    productionBase: project.productionBase,
    localPort: project.localPort,
    localPath: project.localPath
  });
}
