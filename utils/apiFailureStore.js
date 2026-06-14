const failures = [];

export function recordApiFailure(apiName, response) {
  failures.push({
    apiName,
    status: response.status,
    responseBody:
      typeof response.body === 'string'
        ? response.body
        : JSON.stringify(response.body),
    url: response.url || 'N/A',
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[FAILURE_STORE] ${apiName} Status=${response.status} Count=${failures.length}`
  );
}
