import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';
import { recordLiveSessionDuration } from '../utils/metrics.js';

export function getLiveSession(sessionId, token, env) {
  const url = `${env.baseUrl}/live-sessions/${sessionId}`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  console.log(`[DEBUG] Live Session Id: ${sessionId}`);

  const response = request('GET', url, null, params);

  if (response.timings && response.timings.duration) {
    recordLiveSessionDuration(response.timings.duration);
  }

  console.log(`[DEBUG] Status Code: ${response.status}`);
  checkResponse(response, 200, 'joinLiveSession');

  return response.json() || {};
}
