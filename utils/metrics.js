import { Trend, Counter, Rate } from 'k6/metrics';

const customMetrics = {
  // API Failure Counters (Failure-Only Tracking)
  apiFailureCount: new Counter('api_failure_count'),
  loginApiFailure: new Counter('login_api_failure_count'),
  getAllCoursesFailure: new Counter('get_all_courses_failure_count'),
  getMyCoursesFailure: new Counter('get_my_courses_failure_count'),
  getCourseContentFailure: new Counter('get_course_content_failure_count'),
  getCourseRoadmapFailure: new Counter('course_roadmap_failure_count'),
  checkCourseEnrollmentFailure: new Counter('course_enrollment_check_failure_count'),
  getCouponsPublicFailure: new Counter('coupons_public_failure_count'),
  validateCouponFailure: new Counter('validate_coupon_failure_count'),
  getBillingAddressFailure: new Counter('get_billing_address_failure_count'),
  addBillingAddressFailure: new Counter('add_billing_address_failure_count'),
  createOrderFailure: new Counter('create_order_failure_count'),
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
  courseRoadmapDuration: new Trend('Get_Course_Roadmap'),
  courseEnrollmentCheckDuration: new Trend('Check_Course_Enrollment'),
  couponsPublicDuration: new Trend('Get_Coupons_Public'),
  validateCouponDuration: new Trend('Validate_Coupon'),
  getBillingAddressDuration: new Trend('Get_Billing_Address'),
  addBillingAddressDuration: new Trend('Add_Billing_Address'),
  createOrderDuration: new Trend('Create_Order'),
  openLessonDuration: new Trend('Open_Lesson'),
  openLiveLessonDuration: new Trend('Open_Live_Lesson'),
  liveSessionDuration: new Trend('Join_Live_Session'),
  allCoursesDuration: new Trend('All_Courses_Duration'),
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

export function recordCourseRoadmapDuration(durationMs) {
  customMetrics.courseRoadmapDuration.add(durationMs);
}

export function recordCourseEnrollmentCheckDuration(durationMs) {
  customMetrics.courseEnrollmentCheckDuration.add(durationMs);
}

export function recordCouponsPublicDuration(durationMs) {
  customMetrics.couponsPublicDuration.add(durationMs);
}

export function recordValidateCouponDuration(durationMs) {
  customMetrics.validateCouponDuration.add(durationMs);
}

export function recordGetBillingAddressDuration(durationMs) {
  customMetrics.getBillingAddressDuration.add(durationMs);
}

export function recordAddBillingAddressDuration(durationMs) {
  customMetrics.addBillingAddressDuration.add(durationMs);
}

export function recordCreateOrderDuration(durationMs) {
  customMetrics.createOrderDuration.add(durationMs);
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

export function recordAllCoursesDuration(durationMs) {
  customMetrics.allCoursesDuration.add(durationMs);
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

export function recordGetCourseRoadmapFailure() {
  customMetrics.getCourseRoadmapFailure.add(1);
}

export function recordCheckCourseEnrollmentFailure() {
  customMetrics.checkCourseEnrollmentFailure.add(1);
}

export function recordGetCouponsPublicFailure() {
  customMetrics.getCouponsPublicFailure.add(1);
}

export function recordValidateCouponFailure() {
  customMetrics.validateCouponFailure.add(1);
}

export function recordGetBillingAddressFailure() {
  customMetrics.getBillingAddressFailure.add(1);
}

export function recordAddBillingAddressFailure() {
  customMetrics.addBillingAddressFailure.add(1);
}

export function recordCreateOrderFailure() {
  customMetrics.createOrderFailure.add(1);
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
