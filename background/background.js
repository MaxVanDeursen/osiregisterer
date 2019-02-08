var brightspaceURL = "https://brightspace-cc.tudelft.nl/my-courses",
    ssoURL = "https://gatekeeper2.tudelft.nl/openaselect/profiles/saml2/sso/web?",
    registerURL = "https://osistud.tudelft.nl/osiris_student/Inschrijven.do",
    deregisterURL = "https://osistud.tudelft.nl/osiris_student/InschrijvenOverzicht.do";

chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    if (response.function === "updateCourses") {
        updateCourses();
    } else if (response.function === "updateExams") {
        updateExams();
    } else if (response.function === "test") {
        registerExams("WM0713TU", []);
    } else if (response.function === "test2") {
        deregisterExams([{courseCode: "WM0713TU", date: "13/03/2019", time: "18.30 - 21.30"}]);
    } else if (response.function === "register") {
        registerExams(response.courseCode, [response.exam]);
    } else if (response.function === "deregister") {
        deregisterExams([response.exam]);
    }
});

function updateCourses() {
    chrome.tabs.create({url: brightspaceURL, active: false}, function (tab) {
        let listener = function (response, sender, sendResponse) {
            if (sender.url.includes(brightspaceURL) && sender.tab.id === tab.id) {
                chrome.storage.sync.get("courses", function (values) {
                    var courses = "courses" in values ? values.courses : [];
                    response.courses.forEach(course => {
                        course.normal = 2;
                        course.resit = 2;
                    });
                    chrome.storage.sync.set({courses: _.unionBy(courses, response.courses, 'courseCode')});
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

function updateExams() {
    chrome.storage.sync.get(["courses"], function (values) {
        var courses = "courses" in values ? values.courses : [];
        var currentIndex = 1;
        let callback = function() {
            if (currentIndex < courses.length) {
                registerExams(courses[currentIndex++].courseCode, [], callback)
            } else {
                deregisterExams([]);
            }
        };

        registerExams(courses[0].courseCode, [], callback);
    });
}


function registerExams(courseCode, exams, callback) {
    chrome.tabs.create({url: registerURL, active: false}, function (tab) {
        var scriptInjectorListener = injectionListener(tab.id, registerURL, {file: "content-scripts/register.js"});
        let listener = function (response, sender, sendResponse) {
            if (sender.tab && sender.tab.id === tab.id) {
                if (response.phase === "courseLookup") {
                    chrome.tabs.onUpdated.addListener(scriptInjectorListener);
                    sendResponse({"courseCode": courseCode});
                } else if (response.phase === "lookup") {
                    chrome.tabs.onUpdated.addListener(injectionListener(tab.id, "https://osistud.tudelft.nl/osiris_student/InschrijvenToets.do", {file: "content-scripts/register.js"}));
                    chrome.storage.sync.get(null, function (values) {
                        let savedExams = "exams" in values ? values.exams : [];
                        let savedCourses = "courses" in values ? values.courses : [];
                        let indices = selectExams(response.exams, exams, savedExams, savedCourses, values, true);
                        chrome.storage.sync.set({exams: _(response.exams.concat(savedExams)).uniqBy(e => [e.date, e.time].join()).value()});
                        sendResponse({indices: indices});
                    });
                    return true;
                } else if (response.phase === "done") {
                    chrome.runtime.onMessage.removeListener(listener);
                    chrome.tabs.remove(tab.id);
                    typeof callback === 'function' && callback();
                }
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.tabs.onUpdated.addListener(scriptInjectorListener);
    });
}

function deregisterExams(exams, callback) {
    chrome.tabs.create({url: deregisterURL, active: false}, function (tab) {
        var scriptInjectorListener = injectionListener(tab.id, deregisterURL, {"file": "content-scripts/deregister.js"});
        let listener = function (response, sender, sendResponse) {
            if (sender.tab && sender.tab.id === tab.id) {
                if (response.phase === "lookup") {
                    chrome.tabs.onUpdated.addListener(scriptInjectorListener);
                    chrome.storage.sync.get(null, function (values) {
                        let savedExams = "exams" in values ? values.exams : [];
                        let savedCourses = "courses" in values ? values.courses : [];
                        let indices = selectExams(response.exams, exams, savedExams, savedCourses, values, false);
                        chrome.storage.sync.set({exams: _(response.exams.concat(savedExams)).uniqBy(e => [e.date, e.time].join()).value()});

                        let extrCourses = response.exams.map(e => {
                            return {courseCode: e.courseCode, courseName: e.courseName, normal: 2, resit: 2}
                        });
                        chrome.storage.sync.set({courses: _.unionBy(savedCourses, extrCourses, "courseCode")});
                        sendResponse({indices: indices});
                    });
                    return true;
                } else if (response.phase === "confirm") {
                    chrome.tabs.onUpdated.addListener(scriptInjectorListener);
                    sendResponse({});
                } else if (response.phase === "done") {
                    chrome.runtime.onMessage.removeListener(listener);
                    chrome.tabs.remove(tab.id);
                    typeof callback === 'function' && callback();
                }
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.tabs.onUpdated.addListener(scriptInjectorListener);
    });
}

function selectExams(parsedExams, sentExams, savedExams, savedCourses, defaults, registration) {
    let indices = [];
    parsedExams.forEach(function (exam) {
        if (sentExams.filter(e => e.date === exam.date && e.time === exam.time).length > 0) {
            exam.registered = registration;
            indices.push(exam.index);
            return;
        }
        let fExams = savedExams.filter(e => e.date === exam.date && e.time === exam.time);
        if (registration && fExams.length === 0) {
            let fCourses = savedCourses.filter(c => c.courseCode === exam.courseCode);
            switch (exam.opportunity) {
                case "1":
                    if (fCourses.length > 0 && (fCourses[0].normal === 1 || (fCourses[0].normal === 2 && defaults.defaultNormal))) {
                        exam.registered = registration;
                        indices.push(exam.index);
                    } else if (defaults.defaultNormal) {
                        exam.registered = registration;
                        indices.push(exam.index);
                    }
                    break;
                case "2":
                    if (fCourses.length > 0 && (fCourses[0].resit === 1 || (fCourses[0].resit === 2 && defaults.defaultResit))) {
                        exam.registered = registration;
                        indices.push(exam.index);
                    } else if (defaults.defaultResit) {
                        exam.registered = registration;
                        indices.push(exam.index)
                    }
            }
        } else if (fExams.length > 0) {
            exam.registered = fExams[0].registered;
        } else {
            exam.registered = !registration;
        }
    });
    return indices;
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