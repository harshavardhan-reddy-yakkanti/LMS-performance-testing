export const defaultOptions = {
  scenarios: {
    smoke: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '100s',
      preAllocatedVUs: 10,
      maxVUs: 20,
    },
  },
  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(90)',
    'p(95)',
    'p(99)',
  ],
};
