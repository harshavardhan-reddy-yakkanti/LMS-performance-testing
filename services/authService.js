import { request } from '../utils/apiClient.js';
import { recordLoginDuration, recordLoginApiFailure, recordApiFailureMetric } from '../utils/metrics.js';
import { addFailure } from '../utils/failureCollector.js';
import { checkResponse } from '../utils/checks.js';

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
    params
  );

  const passed = checkResponse(response, 200, 'login');
  if (!passed) {
    throw new Error(`login failed`);
  }

  let body;
  try {
    body = response.json();
  } catch (err) {
    throw new Error(`login response JSON parse failed`);
  }

  if (response.timings && response.timings.duration !== undefined) {
    recordLoginDuration(response.timings.duration);
  }

  if (!body || body.success !== true) {
    recordLoginApiFailure();
    recordApiFailureMetric('login', response.status);
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
