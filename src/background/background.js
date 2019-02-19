// URLs which are used to register, deregister and update the exams and courses.
const brightspaceURL = 'https://brightspace-cc.tudelft.nl/my-courses';
const ssoURL = 'https://gatekeeper2.tudelft.nl/openaselect/profiles/saml2/sso/web?';
const registerURL = 'https://osistud.tudelft.nl/osiris_student/Inschrijven.do';
const deregisterURL = 'https://osistud.tudelft.nl/osiris_student/InschrijvenOverzicht.do';

// Execute functions when the corresponding messages are received.
chrome.runtime.onMessage.addListener((response, sender, sendResponse) => {
  if (response.function === 'updateCourses') {
    updateCourses();
  } else if (response.function === 'updateExams') {
    updateExams();
  } else if (response.function === 'register') {
    registerExams(response.courseCode, [response.exam]);
  } else if (response.function === 'deregister') {
    deregisterExams([response.exam]);
  }
});

// Update courses and exams on startup when the default is set.
chrome.storage.sync.get(['defaultStartup'], (values) => {
  if (values.defaultStartup) {
    updateCourses(updateExams);
  }
});

// Set defaults to their initial values on installation of the extension.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({defaultNormal: false, defaultResit: false, defaultStartup: false});
    chrome.runtime.openOptionsPage();
  }
});


/**
 * Update the saved courses.
 *
 * @param {function} callback - A function which is called after the execution of this function is done.
 */
function updateCourses(callback) {
  chrome.tabs.create({url: brightspaceURL, active: false}, function(tab) {
    const listener = function(response, sender, sendResponse) {
      if (sender.url.includes(brightspaceURL) && sender.tab.id === tab.id) {
        chrome.storage.sync.get('courses', function(values) {
          const courses = 'courses' in values ? values.courses : [];
          response.courses.forEach((course) => {
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
    chrome.tabs.onUpdated.addListener(injectionListener(tab.id, brightspaceURL,
        {'file': 'src/content-scripts/parseCourses.js'}));
    chrome.tabs.onUpdated.addListener(injectionListener(tab.id, ssoURL,
        {'file': 'src/content-scripts/ssoLogin.js'}));
  });
}

/**
 * Update the saved exams.
 *
 * Updating these exams is done by going through all open exams for each course, as well as checking the exams
 * for which the student is currently registered.
 */
function updateExams() {
  chrome.storage.sync.get(['courses'], function(values) {
    const courses = 'courses' in values ? values.courses : [];
    let currentIndex = 0;
    const callback = function() {
      if (currentIndex < courses.length - 1) {
        registerExams(courses[currentIndex++].courseCode, [], callback);
      } else {
        registerExams(courses[currentIndex++].courseCode, [], null);
      }
    };

    deregisterExams([], callback);
  });
}

/**
 * Check and register exams for the specified course.
 *
 * This function saves exams as well which have not been encountered before.
 *
 * @param {string} courseCode The course code of the course to register the exams for.
 * @param {array}  exams      The exams which have to be registered.
 * @param {function} callback A function which is called after this method.
 */
function registerExams(courseCode, exams, callback) {
  chrome.tabs.create({url: registerURL, active: false}, (tab) => {
    const scriptInjectorListener = injectionListener(tab.id, registerURL,
        {file: 'src/content-scripts/register.js'});
    const listener = (response, sender, sendResponse) => {
      if (sender.tab && sender.tab.id === tab.id) {
        if (response.phase === 'error') {
          alert(createErrorMessage(response.message));
        }
        if (response.phase === 'courseLookup') {
          chrome.tabs.onUpdated.addListener(scriptInjectorListener);
          sendResponse({'courseCode': courseCode});
        } else if (response.phase === 'lookup') {
          chrome.tabs.onUpdated.addListener(injectionListener(tab.id,
              'https://osistud.tudelft.nl/osiris_student/InschrijvenToets.do',
              {file: 'src/content-scripts/register.js'}));
          chrome.storage.sync.get(null, (values) => {
            const savedExams = 'exams' in values ? values.exams : [];
            const savedCourses = 'courses' in values ? values.courses : [];
            const indices = selectExams(response.exams, exams, savedExams, savedCourses, values, true);
            chrome.storage.sync.set({
              exams: _(response.exams.concat(savedExams))
                  .uniqBy((e) => [e.date, e.time].join())
                  .value(),
            });
            sendResponse({indices: indices});
          });
          return true;
        } else if (response.phase === 'done' || response.phase === 'error') {
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
 * @param {array}    exams     An array of exams which are requested to be deregistered.
 * @param {function} callback  A function which is called after the method is done.
 */
function deregisterExams(exams, callback) {
  chrome.tabs.create({url: deregisterURL, active: false}, function(tab) {
    const scriptInjectorListener = injectionListener(tab.id, deregisterURL,
        {'file': 'src/content-scripts/deregister.js'});
    let foundExams = [];
    const listener = function(response, sender, sendResponse) {
      if (sender.tab && sender.tab.id === tab.id) {
        if (response.phase === 'error') {
          alert(createErrorMessage(response.message));
        }
        if (response.phase === 'lookup') {
          chrome.tabs.onUpdated.addListener(scriptInjectorListener);
          chrome.storage.sync.get(null, function(values) {
            foundExams = response.exams;
            const savedExams = 'exams' in values ? values.exams : [];
            const savedCourses = 'courses' in values ? values.courses : [];
            const indices = selectExams(foundExams, exams, savedExams, savedCourses, values, false);
            const extraCourses = foundExams.map((e) => ({
              courseCode: e.courseCode,
              courseName: e.courseName,
              normal: 2,
              resit: 2,
            }));
            chrome.storage.sync.set({courses: _.unionBy(savedCourses, extraCourses, 'courseCode')});
            sendResponse({indices: indices});
          });
          return true;
        } else if (response.phase === 'confirm') {
          chrome.tabs.onUpdated.addListener(scriptInjectorListener);
          sendResponse({});
        } else if (response.phase === 'done') {
          chrome.runtime.onMessage.removeListener(listener);
          chrome.tabs.remove(tab.id);
          chrome.storage.sync.get(['exams'], (values) => {
            let exams = 'exams' in values ? values.exams : [];
            exams.forEach((e) => e.registered = false);
            exams = foundExams.concat(_.differenceBy(exams, foundExams, (e) => e.date + e.time));
            chrome.storage.sync.set({exams: exams});
            typeof callback === 'function' && callback();
          });
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    chrome.tabs.onUpdated.addListener(scriptInjectorListener);
  });
}

/**
 * Select exams which have to be registered or deregistered, depending on the registration boolean
 * @param {array} parsedExams    The exams that have been parsed from the webpage and have to be either selected or not.
 * @param {array} requestedExams The exams which have been specifically requested to be selected.
 * @param {array} savedExams     The exams which have already been saved so far.
 * @param {array} savedCourses   The courses which have already been saved so far.
 * @param {Object.<defaultNormal, defaultResit>}  defaults The defaults set by the user.
 * @param {array} registration   Whether selection for registration or deregistration is considered.
 * @return {array}               The array of indices of the exams from parsedExams which have to be selected.
 */
function selectExams(parsedExams, requestedExams, savedExams, savedCourses, defaults, registration) {
  const indices = [];
  parsedExams.forEach(function(exam) {
    if (requestedExams.filter((e) => e.date === exam.date && e.time === exam.time).length > 0) {
      exam.registered = registration;
      indices.push(exam.index);
      return;
    }
    const fExams = savedExams.filter((e) => e.date === exam.date && e.time === exam.time);
    if (registration && fExams.length === 0) {
      const fCourses = savedCourses.filter((c) => c.courseCode === exam.courseCode);
      switch (exam.opportunity) {
        case '1':
          if (fCourses.length > 0 &&
              (fCourses[0].normal === 1 || (fCourses[0].normal === 2 && defaults.defaultNormal))) {
            exam.registered = registration;
            indices.push(exam.index);
          } else if (defaults.defaultNormal) {
            exam.registered = registration;
            indices.push(exam.index);
          }
          break;
        case '2':
          if (fCourses.length > 0 && (fCourses[0].resit === 1 || (fCourses[0].resit === 2 && defaults.defaultResit))) {
            exam.registered = registration;
            indices.push(exam.index);
          } else if (defaults.defaultResit) {
            exam.registered = registration;
            indices.push(exam.index);
          }
      }
    } else if (fExams.length > 0) {
      /*
      * Update the received exam correctly.
      * Where registration is concerned, if we see that we already have saved that this exam is registered, copy this.
      * Where deregistration is concerned, if we see that we already have saved that this exam is registered (but we
      * still encounter this exam meaning that it is registered, set it to registered.
      */
      exam.registered = fExams[0].registered || !registration;
    } else {
      exam.registered = !registration;
    }
  });
  return indices;
}

/**
 * Create a listener on the tab with the tabIndex, and execute the executionObject when the tab is completely loaded.
 * @param {int} tabIndex                  The index of the tab to be listened to.
 * @param {string} url                    The url of the website to be listened to.
 * @param {Object.<file>} executionObject The object with configuration for the execution on the tab when completed.
 * @return {listener}                    The created listener using the provided arguments.
 */
function injectionListener(tabIndex, url, executionObject) {
  const listener = function(tabId, changeInfo, tab) {
    if (tabId === tabIndex && changeInfo.status === 'complete' && tab.url.includes(url)) {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.executeScript(tabIndex, executionObject);
    }
  };
  return listener;
}

/**
 * Create a complete error message using the error message returned by Osiris.
 * @param {string} errorMessage The error message given by Osiris.
 * @return {string}             The complete error message.
 */
function createErrorMessage(errorMessage) {
  return 'An error has occurred with the message ' + errorMessage + '. Please report this to OsiRegisterer, either' +
      ' on GitHub (github.com/MaxvanDeursen/OsiRegisterer) or through email (OsiRegisterer@gmail.com)';
}
