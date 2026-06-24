import { request } from '../utils/apiClient.js';
import { checkResponse } from '../utils/checks.js';

export function adminLogin(baseUrl, email, password) {
  const url = `${baseUrl}/auth/login`;
  const payload = JSON.stringify({ email, password });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const response = request('POST', url, payload, params);
  const passed = checkResponse(response, 200, 'adminLogin');
  if (!passed) {
    throw new Error(`adminLogin failed`);
  }

  return response.json();
}

export function getUserAnalytics(baseUrl, token, search) {
  const url = `${baseUrl}/user-analytics/?limit=10&offset=0&search=${encodeURIComponent(search)}&sort_by=joined&sort_order=desc`;
  const params = { headers: { Authorization: `Bearer ${token}` } };

  const response = request('GET', url, null, params);
  const passed = checkResponse(response, 200, 'getUserAnalytics');
  if (!passed) {
    throw new Error(`getUserAnalytics failed`);
  }
  return response.json();
}

export function getUserAnalyticsById(baseUrl, token, userId) {
  const url = `${baseUrl}/user-analytics/user/${userId}`;
  const params = { headers: { Authorization: `Bearer ${token}` } };

  const response = request('GET', url, null, params);
  checkResponse(response, 200, 'getUserAnalyticsById');
  return response.json();
}

export function getCoursesForUser(baseUrl, token, userId) {
  const url = `${baseUrl}/enrollments/get-courses/${userId}`;
  const params = { headers: { Authorization: `Bearer ${token}` } };

  const response = request('GET', url, null, params);
  const passed = checkResponse(response, 200, 'getCoursesForUser');
  if (!passed) {
    throw new Error(`getCoursesForUser failed`);
  }

  return response.json();
}

export function getAdminBillingAddresses(baseUrl, token, userId) {
  const url = `${baseUrl}/enrollments/admin/billing-address/${userId}`;
  const params = { headers: { Authorization: `Bearer ${token}` } };

  const response = request('GET', url, null, params);
  checkResponse(response, 200, 'getAdminBillingAddresses');
  return response.json();
}

export function enrollUserManual(baseUrl, token, payload) {
  const url = `${baseUrl}/enrollments/enroll/manual`;
  const params = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  const body = JSON.stringify(payload);
  const response = request('POST', url, body, params);
  checkResponse(response, 201, 'enrollUserManual');
  return response.json();
}
