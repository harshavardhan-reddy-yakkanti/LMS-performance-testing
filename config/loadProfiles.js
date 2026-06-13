export const loadProfiles = {
  smoke: {
    vus: 2,
    duration: '30s',
  },
  load: {
    stages: [
      { duration: '1m', target: 10 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '2m', target: 150 },
      { duration: '1m', target: 0 },
    ],
  },
};
