import { request } from '../utils/apiClient.js';
import { recordLoginDuration } from '../utils/metrics.js';
import { addFailure } from '../utils/failureCollector.js';

export function login(baseUrl, email, password) {
  const url = `${baseUrl}/auth/login`;
  const payload = JSON.stringify({ email, password });
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = request(
    'POST',
    url,
    payload,
    params,
    'Login_API'
  );
  const body = response.json();

  if (response.timings && response.timings.duration) {
    recordLoginDuration(response.timings.duration);
  }

  if (response.status !== 200) {
    addFailure({
      operation: 'login',
      url,
      status: response.status,
      response: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      vu: typeof __VU !== 'undefined' ? __VU : null,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Login failed with status ${response.status}: ${response.body}`);
  }

  if (!body || body.success !== true) {
    addFailure({
      operation: 'login',
      url,
      status: response.status,
      response: JSON.stringify(body),
      vu: typeof __VU !== 'undefined' ? __VU : null,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Login response invalid or unsuccessful: ${JSON.stringify(body)}`);
  }

  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error('Login did not return required tokens.');
  }

  return {
    response,
    accessToken,
    refreshToken,
  };
}
