// Load the list of course divs, parse the course codes and send them to the background script.
courseList = document.getElementsByClassName("course-list")[0];
courses = [];
for (index = 0; index < courseList.children.length; index++) {
    var splitRow = courseList.children[index].children[0].getAttribute("aria-label").split(" ");
    var courseCode = splitRow[0];
    var courseName = splitRow.slice(1, splitRow.length - 2).join(" ");
    courses.push({"courseCode": courseCode, "courseName": courseName});
}
console.log(courses);
chrome.runtime.sendMessage({"courses": courses});