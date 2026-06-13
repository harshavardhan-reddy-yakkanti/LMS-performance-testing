export function loadJson(path) {
  return JSON.parse(open(path));
}

export function loadUsers() {
  return loadJson('../data/users.json');
}

export function loadCourses() {
  return loadJson('../data/courses.json');
}