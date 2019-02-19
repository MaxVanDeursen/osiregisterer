// Load the list of course divs, parse the course codes and send them to the background script.
const courseList = document.getElementsByClassName('course-list')[0];
const courses = [];
for (let index = 0; index < courseList.children.length; index++) {
  const splitRow = courseList.children[index].children[0].getAttribute('aria-label').split(' ');
  const courseCode = splitRow[0];
  const courseName = splitRow.slice(1, splitRow.length - 2).join(' ');
  courses.push({'courseCode': courseCode, 'courseName': courseName});
}
chrome.runtime.sendMessage({'courses': courses});
