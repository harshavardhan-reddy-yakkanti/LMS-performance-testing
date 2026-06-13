import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';

export function getProgress(courseId, token, env) {
  const url = `${env.baseUrl}/courses/${courseId}/progress`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);
  checkResponse(response, 200, 'getProgress');
  return response.json() || {};
}
