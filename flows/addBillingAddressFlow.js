import {
  addBillingAddress,
} from '../services/enrollmentService.js';

export function executeAddBillingAddressFlow(token, env) {
  return addBillingAddress(token, env);
}