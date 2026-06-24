import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { defaultEnv, environments } from '../config/environments.js';
import { executeLoginFlow } from '../flows/loginFlow.js';
import { loadUsers } from '../utils/dataLoader.js';
import {loadCourses} from '../utils/dataLoader.js';
import { executeLiveLessonFlow } from '../flows/courseAccessFlow.js';
import exec from 'k6/execution';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { getFailures } from '../utils/failureCollector.js';
import { defaultOptions } from '../config/testOptions.js';

const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;
const courses = loadCourses();
const users = loadUsers();

export const options = defaultOptions;

export default function () {
  const user = users[(exec.scenario.iterationInTest) % users.length];
  if (!user) {
    throw new Error('No user data available for smoke test.');
  }

  const { accessToken } = executeLoginFlow(env.baseUrl, user);

  check(accessToken, {
    'access token extracted': (token) => Boolean(token) && token.length > 20,
  });

  console.log('Login Successful');
  console.log(`User Email: ${user.email}`);
  console.log(`Access Token Preview: ${accessToken.slice(0, 20)}`);
  if (!courses || courses.length === 0) {
    throw new Error('No course data available for smoke test.');
  }
  const course = courses[0];

  
  //const liveLessonResponse = executeLiveLessonFlow(course, accessToken, env);

}

export function handleSummary(data) {
 return {
     stdout: textSummary(data, {
       indent: ' ',
       enableColors: true,
     }),
     'performance-framework/reports/smoke.html': htmlReport(data),
     'performance-framework/reports/smoke.json': JSON.stringify(data, null, 2),
     'performance-framework/reports/smoke.failures.json': JSON.stringify(getFailures(), null, 2),
   };

}
