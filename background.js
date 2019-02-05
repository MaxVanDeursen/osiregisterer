var courseCodes = [];
var currentIndex = 0;

/**
 * Receive messages sent by the content scripts.
 */
chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    let url = sender.url,
        id = sender.tab.id;

    if (url.includes("https://brightspace-cc.tudelft.nl/my-courses")) {
        handleBrightSpace(response, id);

    } else if (url.includes("https://osistud.tudelft.nl/osiris_student/Inschrijven.do")) {
        if (response.code === "lookup") {
            startLookup(id, sendResponse);
        } else if (response.code === "return") {
            if (currentIndex < courseCodes.length) {
                chrome.tabs.onUpdated.addListener(injectionListener(id, {"file": "registerCheck.js"}));
            } else {
                currentIndex = 0;
                chrome.tabs.remove(id);
            }
        }
    }
});

function startLookup(tabId, sendResponse) {
    if (currentIndex < courseCodes.length) {
        chrome.tabs.onUpdated.addListener(injectionListener(tabId, {"file": "registerCheck.js"}));
        currentIndex++;
        sendResponse({"courseCode": courseCodes[currentIndex - 1]});
    }
}

function handleBrightSpace(response, tabId) {
    courseCodes = response.courseCodes;
    chrome.tabs.update(tabId, {"url": "https://osistud.tudelft.nl/osiris_student/Inschrijven.do"});
    chrome.tabs.onUpdated.addListener(injectionListener(tabId, {"file": "registerCheck.js"}));
}

/**
 * Create a listener on the tab with the tabIndex, and execute the executionObject when the tab is completely loaded.
 * @param tabIndex          The index of the tab to be listened to.
 * @param executionObject   The object with configuration for the execution on the tab when completed.
 * @returns {listener}      The created listener using the provided arguments.
 */
function injectionListener(tabIndex, executionObject) {
    var listener = function (tabId, changeInfo, tab) {
        if (tabId === tabIndex && changeInfo.status === "complete") {
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
    chrome.tabs.create({"url": "https://brightspace-cc.tudelft.nl/my-courses"}, function (tab) {
        chrome.tabs.onUpdated.addListener(injectionListener(tab.id, {"file": "parseCourses.js"}));
    });
});