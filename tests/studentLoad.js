import { sleep } from 'k6';
import { environments, defaultEnv } from '../config/environments.js';
import { loadProfiles } from '../config/loadProfiles.js';
import { studentCourseAccessFlow } from '../flows/courseAccessFlow.js';
import { performLogin } from '../flows/loginFlow.js';
import { loadUsers, loadCourses } from '../utils/dataLoader.js';
import { recordFailure } from '../utils/metrics.js';

const envName = __ENV.TEST_ENV || defaultEnv.name;
const env = environments[envName] || defaultEnv;
const users = loadUsers();
const courses = loadCourses();
const user = users[0];
const course = courses[0];

export let options = {
  stages: loadProfiles.load.stages,
};

export default function () {
  try {
    const token = performLogin(user, env);
    studentCourseAccessFlow(course.courseId, token, env);
  } catch (error) {
    recordFailure(true);
    throw error;
  }
  sleep(1);
}
