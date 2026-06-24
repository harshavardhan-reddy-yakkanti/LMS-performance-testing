import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';
import {
  recordCourseRoadmapDuration,
  recordCourseEnrollmentCheckDuration,
  recordCouponsPublicDuration,
  recordValidateCouponDuration,
  recordGetBillingAddressDuration,
  recordAddBillingAddressDuration,
  recordCreateOrderDuration,
} from '../utils/metrics.js';

const defaultBillingAddressPayload = {
  address_line1: 'perf testing address',
  country: 'India',
  address_line2: 'perf test',
  state: 'Telangana',
  city: 'Hyderabad',
  postal_code: '504103',
};

export function enrollInCourse(courseId, token, env) {
  const url = `${env.baseUrl}/courses/${courseId}/enroll`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = request('POST', url, null, params);
  checkResponse(response, 200, 'enrollInCourse');
  return response;
}

export function selectCourseForEnrollment(courses) {
  if (!Array.isArray(courses)) {
    return null;
  }

  return courses.find((course) => {
    if (!course) return false;

    // Skip already enrolled courses
    const notEnrolled = course.is_enrolled === false || course.enrollment_status === '' || course.enrollment_status === 'not_enrolled' || course.enrollment_status === 'expired';

    if (!notEnrolled) return false;

    // Determine if course is free.
    // If price or base_price is explicitly null, treat as free.
    // If price/base_price are numeric, only > 0 means paid.
    const explicitFree = typeof course.is_free === 'boolean' ? course.is_free : false;
    const priceValue = course.price;
    const basePriceValue = course.base_price;
    const freeByPrice = priceValue === null || priceValue === 0;
    const freeByBasePrice = basePriceValue === null || basePriceValue === 0;
    const isFree = explicitFree || freeByPrice || freeByBasePrice;

    // We want a course that is NOT free
    const notFree = !isFree;

    return notFree;
  });
}

export function getCourseRoadmap(courseSlug, token, env) {
  const url = `${env.baseUrl}/courses/${courseSlug}/roadmap`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);
  if (response.timings && response.timings.duration) {
    recordCourseRoadmapDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 200, 'getCourseRoadmap');
  if (!passed) {
    throw new Error(`getCourseRoadmap failed`);
  }

  return response.json();
}

export function checkCourseEnrollment(courseId, token, env) {
  const url = `${env.baseUrl}/enrollments/check/${courseId}`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);
  if (response.timings && response.timings.duration) {
    recordCourseEnrollmentCheckDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 200, 'checkCourseEnrollment');
  if (!passed) {
    throw new Error(`checkCourseEnrollment failed`);
  }

  return response.json();
}

export function getCouponsPublic(courseSlug, token, env) {
  const url = `${env.baseUrl}/coupons/public/${courseSlug}`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);
  if (response.timings && response.timings.duration) {
    recordCouponsPublicDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 200, 'getCouponsPublic');
  if (!passed) {
    throw new Error(`getCouponsPublic failed`);
  }

  return response.json() || [];
}

export function validateCoupon(couponCode, courseSlug, token, env) {
  const url = `${env.baseUrl}/coupons/validate`;
  const payload = JSON.stringify({ code: couponCode, course_slug: courseSlug });

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = request('POST', url, payload, params);
  if (response.timings && response.timings.duration) {
    recordValidateCouponDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 200, 'validateCoupon');
  if (!passed) {
    throw new Error(`validateCoupon failed`);
  }

  return response.json();
}

export function getBillingAddresses(token, env) {
  const url = `${env.baseUrl}/users/get-billing-address`;
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = request('GET', url, null, params);
  if (response.timings && response.timings.duration) {
    recordGetBillingAddressDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 200, 'getBillingAddresses');
  if (!passed) {
    throw new Error(`getBillingAddresses failed`);
  }

  const body = response.json();
  return body?.data || [];
}

export function addBillingAddress(token, env, address = defaultBillingAddressPayload) {
  const url = `${env.baseUrl}/users/add-billing-address`;
  const payload = JSON.stringify(address);
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = request('POST', url, payload, params);
  if (response.timings && response.timings.duration) {
    recordAddBillingAddressDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 200, 'addBillingAddress');
  if (!passed) {
    throw new Error(`addBillingAddress failed`);
  }

  return response.json();
}

export function createOrder({ courseId, courseSlug, couponCode, billingAddressId, notes }, token, env) {
  const url = `${env.baseUrl}/payments/create-order`;
  const body = {
    course_id: courseId,
    course_slug: courseSlug,
    notes,
    billing_address_id: billingAddressId,
  };

  if (couponCode) {
    body.coupon_code = couponCode;
  }

  const payload = JSON.stringify(body);
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = request('POST', url, payload, params);
  if (response.timings && response.timings.duration) {
    recordCreateOrderDuration(response.timings.duration);
  }

  const passed = checkResponse(response, 201, 'createOrder');
  if (!passed) {
    throw new Error(`createOrder failed`);
  }

  return response.json();
}
