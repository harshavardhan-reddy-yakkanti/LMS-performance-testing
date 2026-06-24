import { check } from 'k6';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { defaultEnv, environments } from '../config/environments.js';
import { executeManualEnrollmentFlow } from '../flows/manualEnrollmentFlow.js';
import { loadUsers } from '../utils/dataLoader.js';
import { getFailures } from '../utils/failureCollector.js';
import { defaultOptions } from '../config/testOptions.js';

const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;
const users = loadUsers();

export const options = defaultOptions;

export default function () {
  const vuIndex = (exec.vu.idInTest - 1) % users.length;
  const targetUser = users[vuIndex];

  if (!targetUser) {
    throw new Error(`No user mapped for VU ${exec.vu.idInTest}`);
  }

  const adminEmail = __ENV.ADMIN_EMAIL || 'teluskoadmin@gmail.com';
  const adminPassword = __ENV.ADMIN_PASSWORD || 'Telusko@#100@#';

  console.log(`VU ${exec.vu.idInTest} will enroll ${targetUser.email} via admin ${adminEmail}`);

  let result = null;
  try {
    result = executeManualEnrollmentFlow(env, adminEmail, adminPassword, targetUser.email);
    check(result, {
      'enroll response is object': (r) => r && typeof r === 'object',
    });
    console.log('[INFO] manual enrollment completed', JSON.stringify(result));
  } catch (err) {
    console.error('Manual enrollment flow failed:', err && err.message ? err.message : err);
    throw err;
  }
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'performance-framework/reports/manualEnrollment.html': htmlReport(data),
    'performance-framework/reports/manualEnrollment.json': JSON.stringify(data, null, 2),
    'performance-framework/reports/manualEnrollment.failures.json': JSON.stringify(getFailures(), null, 2),
  };
}
