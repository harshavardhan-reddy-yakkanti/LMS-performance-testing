import { check } from 'k6';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { defaultEnv, environments } from '../config/environments.js';
import { executeLoginFlow } from '../flows/loginFlow.js';
import { loadUsers } from '../utils/dataLoader.js';
import { loadCourses } from '../utils/dataLoader.js';
import { executeLiveLessonFlow } from '../flows/courseAccessFlow.js';

const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;

const users = loadUsers();
const courses = loadCourses();

export const options = {
  vus: 10,
  iterations: 10,
};

export default function () {

  const user =
  users[(exec.vu.idInTest - 1) % users.length];

  if (!user) {
    throw new Error(
      `No user mapped for VU ${exec.vu.idInTest}`
    );
  }

  console.log(
    `VU ${exec.vu.idInTest} executing with ${user.email}`
  );

  const { accessToken } = executeLoginFlow(
    env.baseUrl,
    user
  );

  check(accessToken, {
    'access token extracted': (token) =>
      Boolean(token) && token.length > 20,
  });

  console.log('Login Successful');
  console.log(`User Email: ${user.email}`);
  console.log(
    `Access Token Preview: ${accessToken.slice(0, 20)}`
  );

  if (!courses || courses.length === 0) {
    throw new Error(
      'No course data available for smoke test.'
    );
  }

  const course = courses[0];

  executeLiveLessonFlow(
    course,
    accessToken,
    env
  );
}

export function handleSummary(data) {

  return {
    stdout: textSummary(data, {
      indent: ' ',
      enableColors: true,
    }),

    'performance-framework/reports/accessLiveLesson.html':
      htmlReport(data),

    'performance-framework/reports/accessLiveLesson.json':
      JSON.stringify(data, null, 2),
  };
}