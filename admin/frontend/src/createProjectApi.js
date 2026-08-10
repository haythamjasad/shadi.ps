import { requestWithToken } from './projectApiClient.js';

export function createProjectApi({ base, getToken, refreshToken, messageExtractor }) {
  return {
    base,
    get(path, query) {
      return requestWithToken({
        base,
        path,
        query,
        method: 'GET',
        getToken,
        refreshToken,
        messageExtractor
      });
    },
    post(path, body) {
      return requestWithToken({
        base,
        path,
        method: 'POST',
        body,
        getToken,
        refreshToken,
        messageExtractor
      });
    },
    put(path, body) {
      return requestWithToken({
        base,
        path,
        method: 'PUT',
        body,
        getToken,
        refreshToken,
        messageExtractor
      });
    },
    delete(path) {
      return requestWithToken({
        base,
        path,
        method: 'DELETE',
        getToken,
        refreshToken,
        messageExtractor
      });
    }
  };
}
