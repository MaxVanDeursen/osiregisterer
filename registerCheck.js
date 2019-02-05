// When we are at the search page, request the new course code and search.
if (document.getElementsByClassName("psbInvoerTekst").length > 0) {
    chrome.runtime.sendMessage({"code": "lookup"}, function (response) {
        document.getElementsByClassName("psbInvoerTekst")[1].value = response.courseCode;
        document.getElementsByClassName("psbLink")[0].click();
    });
}
// Else, return to the search page.
else {
    chrome.runtime.sendMessage({"code": "return"});
    document.querySelectorAll("button")[4].click();
}
