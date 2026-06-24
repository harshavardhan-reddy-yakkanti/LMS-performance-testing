import { check } from 'k6';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { defaultEnv, environments } from '../config/environments.js';
import { executeLoginFlow } from '../flows/loginFlow.js';
import { executeCourseEnrollFlow } from '../flows/enrollCourseFlow.js';
import { loadUsers } from '../utils/dataLoader.js';
import { getFailures } from '../utils/failureCollector.js';
import { defaultOptions } from '../config/testOptions.js';

const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;
const users = loadUsers().slice(80, 100);

export const options = defaultOptions;

export default function () {
  const user = users[(exec.scenario.iterationInTest) % users.length];

  if (!user) {
    throw new Error(`No user mapped for VU ${exec.vu.idInTest}`);
  }

  console.log(`VU ${exec.vu.idInTest} executing with ${user.email}`);
  const continueOnLoginFailureEnv =
    __ENV.CONTINUE_ON_LOGIN_FAILURE === 'true' || __ENV.CONTINUE_ON_LOGIN_FAILURE === '1';
  const continueOnLoginFailure =
    continueOnLoginFailureEnv || Boolean(env.continueOnLoginFailure);

  let accessToken = null;

  try {
    const tokens = executeLoginFlow(env.baseUrl, user);
    accessToken = tokens?.accessToken;

    check(accessToken, {
      'access token extracted': (token) => Boolean(token) && token.length > 20,
    });

    console.log('Login Successful');
    console.log(`User Email: ${user.email}`);
    console.log(`Access Token Preview: ${accessToken.slice(0, 20)}`);
  } catch (err) {
    console.error('Login failed:', err && err.message ? err.message : err);
    if (!continueOnLoginFailure) {
      throw err;
    }
    console.log('[WARN] CONTINUE_ON_LOGIN_FAILURE is set — continuing despite login failure.');
  }

  try {
    const orderResult = executeCourseEnrollFlow(accessToken, env);
    console.log('[INFO] Enrollment flow completed:', JSON.stringify(orderResult));
  } catch (err) {
    console.error('Enrollment flow failed:', err && err.message ? err.message : err);
    if (!continueOnLoginFailure) {
      throw err;
    }
    console.log('[WARN] CONTINUE_ON_LOGIN_FAILURE is set — continuing despite enrollment failure.');
  }
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, {
      indent: ' ',
      enableColors: true,
    }),
    'performance-framework/reports/enrollCourse.html': htmlReport(data),
    'performance-framework/reports/enrollCourse.json': JSON.stringify(data, null, 2),
    'performance-framework/reports/enrollCourse.failures.json': JSON.stringify(getFailures(), null, 2),
  };
}
