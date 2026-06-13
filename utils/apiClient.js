import http from 'k6/http';
import { sleep } from 'k6';

export function request(method, url, body = null, params = {}) {
  const response = http.request(method, url, body, params);
  return response;
}
