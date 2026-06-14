import { Trend, Counter, Rate } from 'k6/metrics';

const customMetrics = {
  loginSuccess: new Counter('login_success_count'),
  courseAccessSuccess: new Counter('course_access_success_count'),
  missingLessonIds: new Counter('missing_lesson_ids_count'),
  apiFailureCount: new Counter('api_failure_count'),
  failureRate: new Rate('failure_rate'),
  requestDuration: new Trend('request_duration_ms'),
  loginDuration: new Trend('Login_API'),
  courseContentDuration: new Trend('Course_Content_API'),
  openLessonDuration: new Trend('OpenLesson_API'),
  liveSessionDuration: new Trend('Live_Session_API'),
};

export function incrementMetric(name, value = 1) {
  if (customMetrics[name]) {
    customMetrics[name].add(value);
  }
}

export function recordDuration(durationMs) {
  customMetrics.requestDuration.add(durationMs);
}

export function recordLoginDuration(durationMs) {
  customMetrics.loginDuration.add(durationMs);
}

export function recordCourseContentDuration(durationMs) {
  customMetrics.courseContentDuration.add(durationMs);
}

export function recordOpenLessonDuration(durationMs) {
  customMetrics.openLessonDuration.add(durationMs);
}

export function recordLiveSessionDuration(durationMs) {
  customMetrics.liveSessionDuration.add(durationMs);
}

export function recordFailure(isFailed) {
  customMetrics.failureRate.add(isFailed ? 1 : 0);
}

export function recordApiFailureMetric(apiName, statusCode) {
  customMetrics.apiFailureCount.add(1, {
    api: apiName,
    status: String(statusCode),
  });
}

export function getMetrics() {
  return customMetrics;
}
