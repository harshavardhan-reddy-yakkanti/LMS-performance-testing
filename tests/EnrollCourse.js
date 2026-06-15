import { check } from 'k6';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { defaultEnv, environments } from '../config/environments.js';
import { executeLoginFlow } from '../flows/loginFlow.js';
import { executeCourseEnrollFlow } from '../flows/enrollCourseFlow.js';
import { loadUsers } from '../utils/dataLoader.js';

const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;
const users = loadUsers();

export const options = {
  vus: 2,
  iterations: 2,
  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(90)',
    'p(95)',
    'p(99)',
  ]
};

export default function () {
  const user = users[(exec.vu.idInTest - 1) % users.length];

  if (!user) {
    throw new Error(`No user mapped for VU ${exec.vu.idInTest}`);
  }

  console.log(`VU ${exec.vu.idInTest} executing with ${user.email}`);

  const { accessToken } = executeLoginFlow(env.baseUrl, user);

  check(accessToken, {
    'access token extracted': (token) => Boolean(token) && token.length > 20,
  });

  console.log('Login Successful');
  console.log(`User Email: ${user.email}`);
  console.log(`Access Token Preview: ${accessToken.slice(0, 20)}`);

  const orderResult = executeCourseEnrollFlow(accessToken, env);
  console.log('[INFO] Enrollment flow completed:', JSON.stringify(orderResult));
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, {
      indent: ' ',
      enableColors: true,
    }),
    'performance-framework/reports/enrollCourse.html': htmlReport(data),
    'performance-framework/reports/enrollCourse.json': JSON.stringify(data, null, 2),
  };
}
