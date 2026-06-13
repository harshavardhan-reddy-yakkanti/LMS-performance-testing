import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';
import { recordOpenLessonDuration } from '../utils/metrics.js';

function collectLessonIds(node, accumulator = []) {
  if (node == null || typeof node !== 'object') {
    return accumulator;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectLessonIds(item, accumulator));
    return accumulator;
  }

  if (Array.isArray(node.lessons)) {
    node.lessons.forEach((lesson) => {
      if (lesson && typeof lesson === 'object' && lesson.id) {
        accumulator.push(lesson.id);
      }
    });
  }

  Object.keys(node).forEach((key) => {
    if (key === 'lessons') {
      return;
    }

    const child = node[key];
    if (Array.isArray(child) || (child && typeof child === 'object')) {
      collectLessonIds(child, accumulator);
    }
  });

  return accumulator;
}

export function getLessonIds(courseContent, env) {
  const items = Array.isArray(courseContent?.items) ? courseContent.items : [];
  return collectLessonIds(items);
}

function collectLiveLessons(node, accumulator = []) {
  if (node == null || typeof node !== 'object') {
    return accumulator;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectLiveLessons(item, accumulator));
    return accumulator;
  }

  if (Array.isArray(node.lessons)) {
    node.lessons.forEach((lesson) => {
      if (
        lesson &&
        typeof lesson === 'object' &&
        lesson.content_type === 'live' &&
        lesson.id
      ) {
        accumulator.push({
          lessonId: lesson.id,
          title: lesson.title || 'Unknown Title',
          sessionId: lesson.session_id || null,
        });
      }
    });
  }

  Object.keys(node).forEach((key) => {
    if (key === 'lessons') {
      return;
    }

    const child = node[key];
    if (Array.isArray(child) || (child && typeof child === 'object')) {
      collectLiveLessons(child, accumulator);
    }
  });

  return accumulator;
}

export function getLiveLessons(courseContent) {
  const items = Array.isArray(courseContent?.items) ? courseContent.items : [];
  return collectLiveLessons(items);
}

export function getRandomLiveLesson(courseContent) {
  const liveLessons = getLiveLessons(courseContent);
  if (liveLessons.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * liveLessons.length);
  return liveLessons[randomIndex];
}

export function getFirstLiveLesson(courseContent) {
  const liveLessons = getLiveLessons(courseContent);
  if (liveLessons.length === 0) {
    return null;
  }
  return liveLessons[0];
}

export function openLesson(lessonId, token, env) {
  const url = `${env.baseUrl}/lesson/${lessonId}`;

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  console.log(`[DEBUG] Opening Lesson`);
  console.log(`[DEBUG] Lesson Id: ${lessonId}`);
  console.log(`[DEBUG] URL: ${url}`);

  const response = request('GET', url, null, params);

  console.log(`[DEBUG] Status Code: ${response.status}`);
  console.log(`[DEBUG] Response Body: ${response.body}`);

  if (response.timings && response.timings.duration) {
    recordOpenLessonDuration(response.timings.duration);
  }

  checkResponse(response, 200, 'openLesson');

  return response;
}

export function openLiveLesson(lessonId, token, env) {
  const url = `${env.baseUrl}/lesson/${lessonId}`;

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  console.log('[DEBUG] Opening Live Lesson');
  console.log(`[DEBUG] Live Lesson Id: ${lessonId}`);

  const response = request('GET', url, null, params);

  if (response.timings && response.timings.duration) {
    recordOpenLessonDuration(response.timings.duration);
  }

  checkResponse(response, 200, 'openLiveLesson');
  return response;
}
