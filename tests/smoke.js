import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { defaultEnv, environments } from '../config/environments.js';
import { executeLoginFlow } from '../flows/loginFlow.js';
import { loadUsers } from '../utils/dataLoader.js';
import {loadCourses} from '../utils/dataLoader.js';
import { studentCourseAccessFlow, executeLiveLessonFlow } from '../flows/courseAccessFlow.js';


const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;
const users = loadUsers();
const courses = loadCourses();
const user = users[0];

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
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

  //const coursesResponse = studentCourseAccessFlow(course, accessToken, env);
  const liveLessonResponse = executeLiveLessonFlow(course, accessToken, env);

}

export function handleSummary(data) {
  const summary = textSummary(data, { indent: ' ', enableColors: true });

  const metrics = data.metrics;
  const metricsOutput = [];

  metricsOutput.push('\n=== API Duration Metrics ===\n');

  if (metrics.login_duration) {
    const loginStats = metrics.login_duration.values;
    metricsOutput.push('Login API');
    metricsOutput.push(`  avg: ${loginStats.avg.toFixed(2)}ms`);
    metricsOutput.push(`  p90: ${loginStats['p(90)'].toFixed(2)}ms`);
    metricsOutput.push(`  p95: ${loginStats['p(95)'].toFixed(2)}ms`);
    metricsOutput.push('');
  }

  if (metrics.course_content_duration) {
    const courseStats = metrics.course_content_duration.values;
    metricsOutput.push('Course Content API');
    metricsOutput.push(`  avg: ${courseStats.avg.toFixed(2)}ms`);
    metricsOutput.push(`  p90: ${courseStats['p(90)'].toFixed(2)}ms`);
    metricsOutput.push(`  p95: ${courseStats['p(95)'].toFixed(2)}ms`);
    metricsOutput.push('');
  }

  if (metrics.open_lesson_duration) {
    const lessonStats = metrics.open_lesson_duration.values;
    metricsOutput.push('Open Lesson API');
    metricsOutput.push(`  avg: ${lessonStats.avg.toFixed(2)}ms`);
    metricsOutput.push(`  p90: ${lessonStats['p(90)'].toFixed(2)}ms`);
    metricsOutput.push(`  p95: ${lessonStats['p(95)'].toFixed(2)}ms`);
    metricsOutput.push('');
  }

  if (metrics.live_session_duration) {
    const liveStats = metrics.live_session_duration.values;
    metricsOutput.push('Live Session API');
    metricsOutput.push(`  avg: ${liveStats.avg.toFixed(2)}ms`);
    metricsOutput.push(`  p90: ${liveStats['p(90)'].toFixed(2)}ms`);
    metricsOutput.push(`  p95: ${liveStats['p(95)'].toFixed(2)}ms`);
    metricsOutput.push('');
  }

  return {
    stdout: summary + metricsOutput.join('\n'),
  };
}
