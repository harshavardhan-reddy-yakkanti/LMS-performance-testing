export const environments = {
  PROD: {
    name: 'PROD',
    baseUrl: 'https://prod.example.com/api',
    timeout: 60000,
    continueOnLoginFailure: false,
  },
  QA: {
    name: 'QA',
    baseUrl: 'https://qa.example.com/api',
    timeout: 60000,
    continueOnLoginFailure: false,
  },
  STAGE: {
    name: 'STAGE',
    baseUrl: 'https://api-staging.telusko.com/api/v1',
    timeout: 60000,
    continueOnLoginFailure: false,
  },
};

export const defaultEnv = environments.STAGE;
