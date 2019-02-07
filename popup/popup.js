$(function () {
    $("#updateCourses").click(function () {
        chrome.runtime.sendMessage({"function": "updateCourses"});
    });

    $("#updateExams").click(function () {
        chrome.runtime.sendMessage({"function": "updateExams"});
    });

    $("#test").click(function() {
        chrome.runtime.sendMessage({"function": "test"});
    })
    $("#test2").click(function() {
        chrome.runtime.sendMessage({"function": "test2"});
    })
});