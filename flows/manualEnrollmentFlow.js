import { loadUsers } from '../utils/dataLoader.js';
import {
  adminLogin,
  getUserAnalytics,
  getUserAnalyticsById,
  getCoursesForUser,
  getAdminBillingAddresses,
  enrollUserManual,
} from '../services/adminEnrollmentService.js';
import { selectCourseForEnrollment } from '../services/enrollmentService.js';

function extractArrayFromResponse(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.users)) return resp.users;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.courses)) return resp.courses;
  if (Array.isArray(resp?.enrolled_courses)) return resp.enrolled_courses;
  
  return [];
}

export function executeManualEnrollmentFlow(env, adminEmail, adminPassword, targetEmail) {
  const baseUrl = env.baseUrl;

  const adminBody = adminLogin(baseUrl, adminEmail, adminPassword);
  const token = adminBody?.access_token || adminBody?.accessToken || adminBody?.access;
  if (!token) {
    throw new Error('Failed to obtain admin access token');
  }

  const analyticsResp = getUserAnalytics(baseUrl, token, targetEmail);

  const analyticsUsers = extractArrayFromResponse(analyticsResp);
  const analyticsUser = analyticsUsers.find((u) => u && (u.email === targetEmail || u.email?.toLowerCase() === targetEmail?.toLowerCase()));
  if (!analyticsUser) {
    return null;
  }

  const userId = analyticsUser.id || analyticsUser.user_id || analyticsUser.id;
  if (!userId) {
    return null;
  }

//   const localUsers = loadUsers();
//   const matchedLocal = (Array.isArray(localUsers) ? localUsers : []).find((u) => u && (u.email === analyticsUser.email || u.email?.toLowerCase() === analyticsUser.email?.toLowerCase()));
//   if (!matchedLocal) {
//     return null;
//   }

  const coursesResp = getCoursesForUser(baseUrl, token, userId);
  const courses = extractArrayFromResponse(coursesResp);
  if (!courses || courses.length === 0) {
    return null;
  }

  const selectedCourse = selectCourseForEnrollment(courses) || courses[0];
  const courseId = selectedCourse?.id || selectedCourse?.course_id;
  if (!courseId) {
    throw new Error('Selected course missing id');
  }

  const billingResp = getAdminBillingAddresses(baseUrl, token, userId);
  const billingArray = extractArrayFromResponse(billingResp);
  const billingAddressId = billingArray?.[0]?.id || billingResp?.billing_address_id || billingResp?.id;

  const selling_price = selectedCourse?.selling_price || selectedCourse?.price || selectedCourse?.base_price || 100;

  const payload = {
    user_id: userId,
    course_id: courseId,
    expiry_type: 'default',
    selling_price: selling_price,
    billing_address_id: billingAddressId,
    enrollment_type: 'paid',
  };

  console.log("DEBUG - Enrollment Payload: " + JSON.stringify(payload));

  const enrollResp = enrollUserManual(baseUrl, token, payload);
  console.log(`[SUCCESS] Enrolled ${analyticsUser.email} in course ${courseId}`);
  return enrollResp;
}
