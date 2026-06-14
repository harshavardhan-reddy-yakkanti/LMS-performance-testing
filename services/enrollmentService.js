import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';

export function enrollInCourse(courseId, token, env) {
  const url = `${env.baseUrl}/courses/${courseId}/enroll`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = request('POST', url, null, params, 'Enroll_In_Course_API');
  checkResponse(response, 200, 'enrollInCourse');
  return response;
}
