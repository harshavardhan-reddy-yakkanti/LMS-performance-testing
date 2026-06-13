# LMS Performance Testing Framework

A scalable k6 performance testing framework using JavaScript ES6 modules.

## Project Structure

performance-framework/
│
├── config
│   ├── environments.js
│   ├── loadProfiles.js
├── data
│   ├── users.json
│   ├── courses.json
├── services
│   ├── authService.js
│   ├── enrollmentService.js
│   ├── courseService.js
│   ├── lessonService.js
│   ├── progressService.js
├── flows
│   ├── loginFlow.js
│   ├── courseAccessFlow.js
├── utils
│   ├── apiClient.js
│   ├── checks.js
│   ├── metrics.js
│   ├── dataLoader.js
├── tests
│   ├── smoke.js
│   ├── studentLoad.js
├── reports
└── README.md

## Goals

- Support smoke testing, load testing, and stress testing
- Keep API calls inside `services`
- Keep business orchestration inside `flows`
- Use centralized request and validation helpers
- Make the framework easy to extend and maintain

## How it works

- `config/environments.js` manages DEV, QA, and STAGE settings
- `config/loadProfiles.js` defines smoke, load, and stress profiles
- `data/*.json` contains sample users and course metadata
- `utils/apiClient.js` centralizes `k6/http` requests
- `utils/checks.js` holds reusable response validation logic
- `utils/metrics.js` exposes custom metrics for monitoring
- `services/*` keeps API interaction code organized
- `flows/*` composes business flows like login and course access
- `tests/*` orchestrates flows for scenarios

## Running tests

Use k6 to run a scenario from the `performance-framework/tests` folder.

Example:

```powershell
k6 run .\performance-framework\tests\smoke.js
k6 run .\performance-framework\tests\studentLoad.js
```

To target a specific environment:

```powershell
$env:TEST_ENV='QA'
k6 run .\performance-framework\tests\smoke.js
```

## Extending the framework

- Add new service methods in `services/`
- Add new business flows in `flows/`
- Add new scenarios in `tests/`
- Add future performance definitions in `config/loadProfiles.js`
- Store test data in `data/`

## Notes

- This framework uses placeholder URLs and simulated endpoint paths.
- API endpoints should be implemented when the backend contract is available.
