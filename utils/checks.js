import { check } from 'k6';
import { addFailure } from './failureCollector.js';

export function checkResponse(response, expectedStatus, operationName) {
  const passed = check(response, {
    [`${operationName} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });

  if (!passed) {
    console.error(`${operationName} failed: ${response.status} ${response.body}`);

    addFailure({
      operation: operationName,
      url: response.url || 'N/A',
      status: response.status,
      response: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      vu: typeof __VU !== 'undefined' ? __VU : null,
      timestamp: new Date().toISOString(),
    });
  }

  return passed;
}
