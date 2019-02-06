var brightspaceURL = "https://brightspace-cc.tudelft.nl/my-courses",
    ssoURL = "https://gatekeeper2.tudelft.nl/openaselect/profiles/saml2/sso/web?",
    osirisURL = "https://osistud.tudelft.nl/osiris_student/Inschrijven.do";

chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    if (response.function === "updateCourses") {
        updateCourses();
    } else if (response.function === "updateExams") {
        updateExams();
    }
});

function updateCourses() {
    chrome.tabs.create({"url": brightspaceURL, "active": false}, function (tab) {
        let listener = function (response, sender, sendResponse) {
            if (sender.url.includes(brightspaceURL) && sender.tab.id === tab.id) {
                chrome.storage.sync.get("courses", function (values) {
                    var courses = "courses" in values ? values.courses : [];
                    courses = mergeCourses(courses, response.courses);
                    chrome.storage.sync.set({"courses": courses});
                    chrome.runtime.onMessage.removeListener(listener);
                    chrome.tabs.remove(sender.tab.id);
                });
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, brightspaceURL, {"file": "content-scripts/parseCourses.js"}));
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, ssoURL, {"file": "content-scripts/ssoLogin.js"}));
    });
}

function mergeCourses(savedCourses, newCourses) {
    var returnCourses = savedCourses;
    newCourses.forEach(function (course) {
        if (returnCourses.filter(c => c.courseCode === course.courseCode).length === 0) {
            returnCourses.push(course);
        }
    });
    return returnCourses;
}

function updateExams() {
    chrome.storage.sync.get(["courses"], function (values) {
        var courses = "courses" in values ? values.courses : [];
        for (var index = 0; index < courses.length; index++) {
            updateExam(courses[index].courseCode);
        }
    });
}

function updateExam(courseCode) {
    chrome.tabs.create({"url": osirisURL, "active": false}, function (tab) {
        let listener = function (response, sender, sendResponse) {
            if (sender.url.includes(osirisURL) && sender.tab.id === tab.id) {
                chrome.storage.sync.get(null, function (values) {
                    var exams = "exams" in values ? values.exams : [];
                    var courses = "courses" in values ? values.courses : [];
                    if (response.code === "lookup") {
                        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, osirisURL, {"file": "content-scripts/registerCheck.js"}));
                        sendResponse({"courseCode": courseCode});
                    } else if (response.code === "exams") {
                        var selectedExams = selectExams(values, exams, courses, response.exams);
                        var selectedIndices = selectedExams.filter(element => element.registered).map(element => element.index);
                        selectedExams.forEach(function (exam) {
                            delete exam.index
                        });
                        chrome.storage.sync.set({"exams": mergeExamLists(exams, selectedExams)});
                        chrome.runtime.onMessage.removeListener(listener);
                        chrome.tabs.remove(sender.tab.id);
                        sendResponse({"selected": selectedIndices});
                    } else if (response.code === "done") {
                        chrome.runtime.onMessage.removeListener(listener);
                        chrome.tabs.remove(sender.tab.id);
                    }
                });
                return true;
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, osirisURL, {"file": "content-scripts/registerCheck.js"}));
    });
}

function selectExams(defaults, exams, courses, newExams) {
    newExams.forEach(function (exam) {
        var filteredExams = exams.filter(e => e.date === exam.date && e.time === exam.time);
        var filteredCourses = courses.filter(course => course.courseCode === exam.courseCode);
        if (filteredExams.length > 0) {
            exam.registered = filteredExams[0].registered;
        } else {
            switch (exam.opportunity) {
                case "1":
                    exam.registered = filteredCourses.length > 0 && filteredCourses[0].normal ? filteredCourses[0].normal : defaults.defaultNormal;
                    break;
                case "2":
                    exam.registered = filteredCourses.length > 0 && filteredCourses[0].resit ? filteredCourses[0].resit : defaults.defaultResit;
                    break;
                default:
                    exam.registered = false;
            }
        }

    });
    return newExams;
}

function mergeExamLists(oldList, newList) {
    var returnList = oldList;
    newList.forEach(function (exam) {
        var equalExams = oldList.filter(e => e.date === exam.date && e.time === exam.time);
        if (equalExams.length === 0) {
            returnList.push(exam);
        } else {
            equalExams[0].registered = exam.registered;
        }
    });
    return returnList;
}

/**
 * Create a listener on the tab with the tabIndex, and execute the executionObject when the tab is completely loaded.
 * @param tabIndex          The index of the tab to be listened to.
 * @param url               The url of the website to be listened to.
 * @param executionObject   The object with configuration for the execution on the tab when completed.
 * @returns {listener}      The created listener using the provided arguments.
 */
function injectionListener(tabIndex, url, executionObject) {
    var listener = function (tabId, changeInfo, tab) {
        if (tabId === tabIndex && changeInfo.status === "complete" && tab.url.includes(url)) {
            chrome.tabs.onUpdated.removeListener(listener);
            chrome.tabs.executeScript(tabIndex, executionObject);
        }
    };
    return listener
}