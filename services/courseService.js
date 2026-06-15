import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';
import { getLessonIds } from './lessonService.js';
import { recordCourseContentDuration,recordMyCoursesDuration } from '../utils/metrics.js';

export function getMyCourses(token, env) {
  const url = `${env.baseUrl}/enrollments/my-courses`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);
  checkResponse(response, 200, 'getMyCourses');
  if (response.timings && response.timings.duration) {
    recordMyCoursesDuration(response.timings.duration);
  }

  const courses = response.json() || [];
  const firstCourse = Array.isArray(courses) && courses.length > 0 ? courses[0] : {};

  console.log(`[DEBUG] Courses Count: ${Array.isArray(courses) ? courses.length : 0}`);
  console.log(`[DEBUG] First Course Id: ${firstCourse.course_id || firstCourse.id || 'N/A'}`);
  console.log(`[DEBUG] First Course Slug: ${firstCourse.course_slug || firstCourse.slug || 'N/A'}`);

  return courses;
}

export function getCourseContent(courseSlug, token, env) {
  const url = `${env.baseUrl}/courses/noauth/content/${courseSlug}`;

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };


  const response = request('GET', url, null, params);

  checkResponse(response, 200, 'getCourseContent');

  if (response.timings && response.timings.duration) {
    recordCourseContentDuration(response.timings.duration);
  }

  const content = response.json() || {};

  const lessonIds = getLessonIds(content);

  console.log(
    `[DEBUG] Course Id: ${content?.course?.id || 'N/A'}`
  );

  console.log(
    `[DEBUG] Course Title: ${content?.course?.title || 'N/A'}`
  );

  console.log(
    `[DEBUG] Items Count: ${content?.items?.length || 0}`
  );

  console.log(
    `[DEBUG] First Item Type: ${content?.items?.[0]?.type || 'N/A'}`
  );

  console.log(
    `[DEBUG] Lesson Count: ${lessonIds.length}`
  );

  if (lessonIds.length > 0) {
    console.log(
      `[DEBUG] First Lesson Id: ${lessonIds[0]}`
    );
  }

  return content
}
