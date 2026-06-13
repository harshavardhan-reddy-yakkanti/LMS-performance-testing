export const environments = {
  PROD: {
    name: 'PROD',
    baseUrl: 'https://prod.example.com/api',
    timeout: 60000,
  },
  QA: {
    name: 'QA',
    baseUrl: 'https://qa.example.com/api',
    timeout: 60000,
  },
  STAGE: {
    name: 'STAGE',
    baseUrl: 'https://342zr37mgc.ap-south-1.awsapprunner.com/api/v1',
    timeout: 60000,
  },
};

export const defaultEnv = environments.STAGE;
