import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';
import { recordLiveSessionDuration } from '../utils/metrics.js';

export function joinLiveSession(sessionId, token, env) {
  const url = `${env.baseUrl}/live-sessions/${sessionId}`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);

  if (response.timings && response.timings.duration) {
    recordLiveSessionDuration(response.timings.duration);
  }

  checkResponse(response, 200, 'joinLiveSession');

  return response.json() || {};
}
