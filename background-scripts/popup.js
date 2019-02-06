$(function () {
    $("#updateCourses").click(function () {
        chrome.runtime.sendMessage({"function": "updateCourses"});
    });

    $("#updateExams").click(function () {
        chrome.runtime.sendMessage({"function": "updateExams"});
    });
});