const failures = [];

export function addFailure(entry) {
  failures.push(entry);
  console.log(
  `Failure Count = ${failures.length}`
);
}

export function getFailures() {
  return failures;
}
