import { getMyCourses, getCourseContent } from '../services/courseService.js';
import {
  getLessonIds,
  getLiveLessons,
  getRandomLiveLesson,
  getFirstLiveLesson,
  openLesson,
  openLiveLesson,
} from '../services/lessonService.js';
import { joinLiveSession } from '../services/liveSessionService.js';
import { incrementMetric } from '../utils/metrics.js';


export function executeLiveLessonFlow(course, token, env) {
  const courseContent = getCourseContent(course.courseSlug, token, env);
  const liveLessons = getLiveLessons(courseContent);

  const selectedLiveLesson = getRandomLiveLesson(courseContent);
  if (!selectedLiveLesson) {
    return null;
  }

  const response = openLiveLesson(selectedLiveLesson.lessonId, token, env);
  const session = joinLiveSession(selectedLiveLesson.sessionId, token, env);

  return {
    response,
    session,
  };
}
