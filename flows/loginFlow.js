import { check } from 'k6';
import { login } from '../services/authService.js';
import { incrementMetric } from '../utils/metrics.js';

export function executeLoginFlow(baseUrl, user) {
  const { response, accessToken, refreshToken } = login(baseUrl, user.email, user.password);

  const passed = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login success is true': (r) => r.json('success') === true,
    'access token is present': (r) => Boolean(r.json('access_token')),
    'refresh token is present': (r) => Boolean(r.json('refresh_token')),
  });

  if (!passed) {
    throw new Error('Login flow validation failed.');
  }

  incrementMetric('loginSuccess');

  return {
    accessToken,
    refreshToken,
  };
}
