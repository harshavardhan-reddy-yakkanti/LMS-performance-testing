import http from 'k6/http';

export function request(method, url, body = null, params = {}) {
  return http.request(method, url, body, params);
}
