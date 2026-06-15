import { check } from 'k6';
import { addFailure } from './failureCollector.js';
import {
  recordGetAllCoursesFailure,
  recordGetMyCoursesFailure,
  recordGetCourseContentFailure,
  recordGetCourseRoadmapFailure,
  recordCheckCourseEnrollmentFailure,
  recordGetCouponsPublicFailure,
  recordValidateCouponFailure,
  recordGetBillingAddressFailure,
  recordAddBillingAddressFailure,
  recordCreateOrderFailure,
  recordOpenLessonFailure,
  recordOpenLiveLessonFailure,
  recordEnrollInCourseFailure,
  recordJoinLiveSessionFailure,
  recordGetProgressFailure,
  recordLoginApiFailure,
  recordApiFailureMetric,
} from './metrics.js';

const failureCounterMap = {
  getAllCourses: recordGetAllCoursesFailure,
  getMyCourses: recordGetMyCoursesFailure,
  getCourseContent: recordGetCourseContentFailure,
  getCourseRoadmap: recordGetCourseRoadmapFailure,
  checkCourseEnrollment: recordCheckCourseEnrollmentFailure,
  getCouponsPublic: recordGetCouponsPublicFailure,
  validateCoupon: recordValidateCouponFailure,
  getBillingAddresses: recordGetBillingAddressFailure,
  addBillingAddress: recordAddBillingAddressFailure,
  createOrder: recordCreateOrderFailure,
  openLesson: recordOpenLessonFailure,
  openLiveLesson: recordOpenLiveLessonFailure,
  enrollInCourse: recordEnrollInCourseFailure,
  joinLiveSession: recordJoinLiveSessionFailure,
  getProgress: recordGetProgressFailure,
  login: recordLoginApiFailure,
};

export function checkResponse(response, expectedStatus, operationName) {
  const passed = check(response, {
    [`${operationName} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });

  if (!passed) {
    console.error(`${operationName} failed: ${response.status} ${response.body}`);

    // Record API failure metric
    recordApiFailureMetric(operationName, response.status);

    // Record specific API failure counter
    if (failureCounterMap[operationName]) {
      failureCounterMap[operationName]();
    }

    addFailure({
      operation: operationName,
      url: response.url || 'N/A',
      status: response.status,
      response: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      vu: typeof __VU !== 'undefined' ? __VU : null,
      timestamp: new Date().toISOString(),
    });
  }

  return passed;
}
