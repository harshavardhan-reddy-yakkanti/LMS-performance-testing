import { request } from '../utils/apiClient.js';
import { recordGetAllCoursesDuration } from '../utils/metrics.js';
import { checkResponse } from '../utils/checks.js';

function getAllCourses(baseUrl, token) {
  const url = `${baseUrl}/enrollments/my-courses`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params, 'Get_All_Courses_API');
  const passed = checkResponse(response, 200, 'getAllCourses');

  if (!passed) {
    throw new Error(`getAllCourses failed with status ${response.status}: ${response.body}`);
  }

  const body = response.json();

  if (response.timings && response.timings.duration) {
    recordGetAllCoursesDuration(response.timings.duration);
  }

  return body;
}