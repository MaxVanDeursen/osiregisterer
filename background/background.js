// URLs which are used to register, deregister and update the exams and courses.
var brightspaceURL = "https://brightspace-cc.tudelft.nl/my-courses",
    ssoURL = "https://gatekeeper2.tudelft.nl/openaselect/profiles/saml2/sso/web?",
    registerURL = "https://osistud.tudelft.nl/osiris_student/Inschrijven.do",
    deregisterURL = "https://osistud.tudelft.nl/osiris_student/InschrijvenOverzicht.do";

// Execute functions when the corresponding messages are received.
chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    if (response.function === "updateCourses") {
        updateCourses();
    } else if (response.function === "updateExams") {
        updateExams();
    } else if (response.function === "register") {
        registerExams(response.courseCode, [response.exam]);
    } else if (response.function === "deregister") {
        deregisterExams([response.exam]);
    }
});

// When the user selects that an update should be ran on startup of the browser, do so.
chrome.storage.sync.get(["defaultStartup"], function (values) {
    if (values.defaultStartup) {
        updateCourses(updateExams);
    }
});

// Add a listener on the first installment of the extension, which sets the defaults to their initial (false) values.
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
        chrome.storage.sync.set({"defaultNormal": false, "defaultResit": false, "defaultStartup": false});
        chrome.runtime.openOptionsPage();
    }
});


/**
 * Update the saved courses.
 *
 * @param callback A function which is called after the execution of this function is done.
 */
function updateCourses(callback) {
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
                    typeof callback === 'function' && callback();
                });
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, brightspaceURL, {"file": "content-scripts/parseCourses.js"}));
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, ssoURL, {"file": "content-scripts/ssoLogin.js"}));
    });
}

/**
 * Update the saved exams.
 *
 * This is done by going through all open exams for each course, as well as the currently registered exams.
 */
function updateExams() {
    chrome.storage.sync.get(["courses"], function (values) {
        var courses = "courses" in values ? values.courses : [];
        var currentIndex = 1;
        let callback = function () {
            if (currentIndex < courses.length) {
                registerExams(courses[currentIndex++].courseCode, [], callback)
            } else {
                deregisterExams([]);
            }
        };

        registerExams(courses[0].courseCode, [], callback);
    });
}

/**
 * Check and register exams for the specified course.
 *
 * This function saves exams as well which have not been encountered before.
 *
 * @param courseCode    The course code of the course to register the exams for.
 * @param exams         The exams which have to be registered.
 * @param callback      A function which is called after the method is done.
 */
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

/**
 * Deregister the exams specified.
 *
 * This function also saves exams and courses which have not been encountered before.
 *
 * @param exams     An array of exams which are requested to be deregistered.
 * @param callback  A function which is called after the method is done.
 */
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

/**
 * Select exams which have to be registered or deregistered, depending on the registration boolean
 * @param parsedExams   The exams that have been parsed from the webpage and have to be either selected or not.
 * @param requestedExams The exams which have been specifically requested to be selected.
 * @param savedExams    The exams which have already been saved so far.
 * @param savedCourses  The courses which have already been saved so far.
 * @param defaults      The defaults set by the user.
 * @param registration  Whether selection for registration or deregistration is considered.
 * @returns {Array}     The array of indices of the exams from parsedExams which have to be selected.
 */
function selectExams(parsedExams, requestedExams, savedExams, savedCourses, defaults, registration) {
    let indices = [];
    parsedExams.forEach(function (exam) {
        if (requestedExams.filter(e => e.date === exam.date && e.time === exam.time).length > 0) {
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