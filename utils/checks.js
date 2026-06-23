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

function formatResponseBody(body) {
  if (body === undefined || body === null) {
    return '<empty>'; 
  }

  if (typeof body === 'string') {
    return body;
  }

  try {
    return JSON.stringify(body);
  } catch (err) {
    return String(body);
  }
}

export function checkResponse(response, expectedStatus, operationName) {
  const passed = check(response, {
    [`${operationName} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });

  if (!passed) {
    const formattedBody = formatResponseBody(response.body);
    console.error(`${operationName} failed: ${response.status}`);
    
    console.error(`${operationName} details: url=${response.url || 'N/A'} headers=${JSON.stringify(response.headers || {})}`);

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
      response: formattedBody,
      vu: typeof __VU !== 'undefined' ? __VU : null,
      timestamp: new Date().toISOString(),
    });
  }

  return passed;
}
