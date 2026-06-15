import { Trend, Counter, Rate } from 'k6/metrics';

const customMetrics = {
  // API Failure Counters (Failure-Only Tracking)
  apiFailureCount: new Counter('api_failure_count'),
  loginApiFailure: new Counter('login_api_failure_count'),
  getAllCoursesFailure: new Counter('get_all_courses_failure_count'),
  getMyCoursesFailure: new Counter('get_my_courses_failure_count'),
  getCourseContentFailure: new Counter('get_course_content_failure_count'),
  enrollInCourseFailure: new Counter('enroll_in_course_failure_count'),
  joinLiveSessionFailure: new Counter('get_live_session_failure_count'),
  getProgressFailure: new Counter('get_progress_failure_count'),
  openLessonFailure: new Counter('open_lesson_failure_count'),
  openLiveLessonFailure: new Counter('open_live_lesson_failure_count'),
  courseAccessSuccess: new Counter('course_access_success_count'),

  // General Metrics
  failureRate: new Rate('failure_rate'),
  requestDuration: new Trend('request_duration_ms'),
  loginDuration: new Trend('Login'),
  myCoursesDuration: new Trend('My_Courses'),
  courseContentDuration: new Trend('Get_Course_Content'),
  openLessonDuration: new Trend('Open_Lesson'),
  openLiveLessonDuration: new Trend('Open_Live_Lesson'),
  liveSessionDuration: new Trend('Join_Live_Session'),
  allCourseDuration: new Trend('All_Course_Duration'),
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

export function recordMyCoursesDuration(durationMs) {
  customMetrics.myCoursesDuration.add(durationMs);
}

export function recordCourseContentDuration(durationMs) {
  customMetrics.courseContentDuration.add(durationMs);
}

export function recordOpenLessonDuration(durationMs) {
  customMetrics.openLessonDuration.add(durationMs);
}

export function recordOpenLiveLessonDuration(durationMs) {
  customMetrics.openLiveLessonDuration.add(durationMs);
}

export function recordLiveSessionDuration(durationMs) {
  customMetrics.liveSessionDuration.add(durationMs);
}

export function recordCourseAccessSuccess(durationMs) {
  customMetrics.courseAccessSuccess.add(durationMs);
}

export function recordAllCourseDuration(durationMs) {
  customMetrics.allCourseDuration.add(durationMs);
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

// Individual API Failure Counters (Only count failures, not successes)
export function recordLoginApiFailure() {
  customMetrics.loginApiFailure.add(1);
}

export function recordGetAllCoursesFailure() {
  customMetrics.getAllCoursesFailure.add(1);
}

export function recordGetMyCoursesFailure() {
  customMetrics.getMyCoursesFailure.add(1);
}

export function recordGetCourseContentFailure() {
  customMetrics.getCourseContentFailure.add(1);
}

export function recordOpenLessonFailure() {
  customMetrics.openLessonFailure.add(1);
}

export function recordOpenLiveLessonFailure() {
  customMetrics.openLiveLessonFailure.add(1);
}

export function recordEnrollInCourseFailure() {
  customMetrics.enrollInCourseFailure.add(1);
}

export function recordJoinLiveSessionFailure() {
  customMetrics.joinLiveSessionFailure.add(1);
}

export function recordGetProgressFailure() {
  customMetrics.getProgressFailure.add(1);
}

export function getMetrics() {
  return customMetrics;
}
