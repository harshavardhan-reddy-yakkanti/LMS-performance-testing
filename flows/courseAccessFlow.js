import { getMyCourses, getCourseContent } from '../services/courseService.js';
import {
  getLessonIds,
  getLiveLessons,
  getRandomLiveLesson,
  getFirstLiveLesson,
  openLesson,
  openLiveLesson,
} from '../services/lessonService.js';
import { getLiveSession } from '../services/liveSessionService.js';
import { incrementMetric } from '../utils/metrics.js';

export function studentCourseAccessFlow(course, token, env) {
    const courseId = course.courseId;
    const courseSlug = course.courseSlug;
    const courses = getMyCourses(token, env);
    const myCourse = courses.find((item) => item.id === courseId) || courses[0] || {};

  const courseContent = getCourseContent(courseSlug , token, env);

  const liveLesson = getFirstLiveLesson(courseContent);
  if (liveLesson) {
    console.log('[DEBUG] Live Lesson Found');
    console.log(`[DEBUG] Lesson Id: ${liveLesson.lessonId}`);
    console.log(`[DEBUG] Session Id: ${liveLesson.sessionId}`);
    console.log(`[DEBUG] Lesson Title: ${liveLesson.title}`);

    const response = openLiveLesson(liveLesson.lessonId, token, env);
    const session = getLiveSession(liveLesson.sessionId, token, env);

    console.log(`[DEBUG] Live Session Title: ${session.title || 'N/A'}`);
    console.log(`[DEBUG] Live Session Status: ${session.status || 'N/A'}`);
    console.log(`[DEBUG] Live Session zoom_join_url: ${session.zoom_join_url || 'N/A'}`);

    incrementMetric('courseAccessSuccess');
    return { response, session };
  }

  const lessonIds = getLessonIds(courseContent, env);

  if (lessonIds.length === 0) {
    incrementMetric('missingLessonIds');
    return null;
  }

  const randomLessonId = lessonIds[Math.floor(Math.random() * lessonIds.length)];
  const response = openLesson(randomLessonId, token, env);

  incrementMetric('courseAccessSuccess');
  return response;
}

export function executeLiveLessonFlow(course, token, env) {
  const courseContent = getCourseContent(course.courseSlug, token, env);
  const liveLessons = getLiveLessons(courseContent);

  console.log(`[DEBUG] Live Lessons Found: ${liveLessons.length}`);

  const selectedLiveLesson = getRandomLiveLesson(courseContent);
  if (!selectedLiveLesson) {
    console.log('[DEBUG] No live lessons available for this course.');
    return null;
  }

  console.log('[DEBUG] Live Lesson Found');
  console.log(`[DEBUG] Lesson Id: ${selectedLiveLesson.lessonId}`);
  console.log(`[DEBUG] Session Id: ${selectedLiveLesson.sessionId}`);

  const response = openLiveLesson(selectedLiveLesson.lessonId, token, env);
  const session = getLiveSession(selectedLiveLesson.sessionId, token, env);

  console.log(`[DEBUG] Live Session Title: ${session.title || 'N/A'}`);
  console.log(`[DEBUG] Live Session Status: ${session.status || 'N/A'}`);
    console.log(`[DEBUG] Live Session zoom_join_url: ${session.zoom_join_url || 'N/A'}`);

  return {
    response,
    session,
  };
}
