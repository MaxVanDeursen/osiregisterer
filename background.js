var courseCodes = [];
var exams = [];
var currentIndex = 0;

var brightspaceURL = "https://brightspace-cc.tudelft.nl/my-courses",
    ssoURL = "https://gatekeeper2.tudelft.nl/openaselect/profiles/saml2/sso/web?",
    osirisURL = "https://osistud.tudelft.nl/osiris_student/Inschrijven.do";

/**
 * Receive messages sent by the content scripts.
 */
chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    let url = sender.url,
        id = sender.tab.id;

    if (url.includes(brightspaceURL)) {
        handleBrightSpace(response, id);

    } else if (url.includes(osirisURL)) {
        if (response.code === "lookup") {
            startLookup(id, sendResponse);
        } else if (response.code === "exams") {
            selectedExams = selectExams(response.exams);
            exams = exams.concat(selectedExams);
            chrome.tabs.onUpdated.addListener(injectionListener(id, osirisURL, {"file": "registerCheck.js"}));
            sendResponse({"selected": selectedExams.filter(element => element.selected).map(element => element.index)});
        } else if (response.code === "return") {
            if (currentIndex < courseCodes.length) {
                chrome.tabs.onUpdated.addListener(injectionListener(id, osirisURL, {"file": "registerCheck.js"}));
            } else {
                currentIndex = 0;
                courseCodes = [];
                chrome.tabs.remove(id);
            }
        }
    }
});

function selectExams(exams) {
    exams.forEach(function(exam) {
        // TODO: Select Exams on other criteria, now it just selects all.
        exam.selected = true;
    });
    return exams;
}

function startLookup(tabId, sendResponse) {
    if (currentIndex < courseCodes.length) {
        chrome.tabs.onUpdated.addListener(injectionListener(tabId, osirisURL, {"file": "registerCheck.js"}));
        currentIndex++;
        sendResponse({"courseCode": courseCodes[currentIndex - 1]});
    }
}

function handleBrightSpace(response, tabId) {
    courseCodes = courseCodes.concat(response.courseCodes);
    chrome.tabs.update(tabId, {"url": osirisURL});
    chrome.tabs.onUpdated.addListener(injectionListener(tabId, osirisURL, {"file": "registerCheck.js"}));
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

/**
 * Start script when the button is clicked.
 */
chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.tabs.create({"url": brightspaceURL}, function (tab) {
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, brightspaceURL, {"file": "parseCourses.js"}));
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, ssoURL, {"file": "ssoLogin.js"}));
    });
});