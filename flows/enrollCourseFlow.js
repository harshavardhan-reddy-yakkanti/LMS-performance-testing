import { getAllCourses } from '../services/courseService.js';
import {
  selectCourseForEnrollment,
  getCourseRoadmap,
  checkCourseEnrollment,
  getCouponsPublic,
  validateCoupon,
  getBillingAddresses,
  addBillingAddress,
  createOrder,
} from '../services/enrollmentService.js';

export function executeCourseEnrollFlow(token, env) {
  const allCoursesResponse = getAllCourses(token, env);
  const courses = Array.isArray(allCoursesResponse?.courses)
    ? allCoursesResponse.courses
    : Array.isArray(allCoursesResponse)
    ? allCoursesResponse
    : [];

  const selectedCourse = selectCourseForEnrollment(courses);

  if (!selectedCourse) {
    return null;
  }

  const courseSlug = selectedCourse.slug || selectedCourse.course_slug || selectedCourse.courseSlug;
  const courseId = selectedCourse.id || selectedCourse.course_id;

  if (!courseSlug || !courseId) {
    throw new Error('Selected course is missing slug or id.');
  }

  getCourseRoadmap(courseSlug, token, env);

  const enrollmentStatus = checkCourseEnrollment(courseId, token, env);
  if (enrollmentStatus?.is_enrolled === true || enrollmentStatus?.status === 'enrolled') {
    return enrollmentStatus;
  }

  const coupons = getCouponsPublic(courseSlug, token, env);
  const selectedCoupon = Array.isArray(coupons) && coupons.length > 0 ? coupons[0] : null;

  const validatedCoupon = selectedCoupon
    ? validateCoupon(selectedCoupon.code, courseSlug, token, env)
    : null;

  getBillingAddresses(token, env);
  const billingAddressId = addBillingAddress(token, env)?.data?.id;

  if (!billingAddressId) {
    throw new Error('Failed to obtain billing address id for order creation.');
  }

  return createOrder(
    {
      courseId,
      courseSlug,
      couponCode: validatedCoupon?.coupon_code || selectedCoupon?.code || null,
      billingAddressId,
      notes: {
        course_id: courseId,
        course_slug: courseSlug,
        customer_name: 'Performance Test User',
        customer_email: 'performance-test@example.com',
        customer_contact: '+919999999999',
      },
    },
    token,
    env
  );
}
