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
