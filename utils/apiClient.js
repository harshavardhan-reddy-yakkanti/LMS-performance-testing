import http from 'k6/http';
import { sleep } from 'k6';
import { recordApiFailureMetric } from './metrics.js';

export function request(method, url, body = null, params = {}, apiName = 'Unknown_API') {
  const response = http.request(method, url, body, params);

  if (response.status >= 400) {
    recordApiFailureMetric(apiName, response.status);
  }

  return response;
}
