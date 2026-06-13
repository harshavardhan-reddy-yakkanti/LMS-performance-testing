import { check } from 'k6';

export function checkResponse(response, expectedStatus, operationName) {
  const passed = check(response, {
    [`${operationName} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });

  if (!passed) {
    console.error(`${operationName} failed: ${response.status} ${response.body}`);
  }

  return passed;
}
