// Load the list of course divs, parse the course codes and send them to the background script.
courseList = document.getElementsByClassName("course-list")[0];
courseCodes = [];
for (index = 0; index < courseList.children.length; index++) {
    courseCodes.push(courseList.children[index].children[0].getAttribute("aria-label").split(" ")[0]);
}

chrome.runtime.sendMessage({"courseCodes": courseCodes});