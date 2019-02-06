// When we are at the search page, request the new course code and search.
if (document.getElementsByClassName("psbInvoerTekst").length > 0) {
    chrome.runtime.sendMessage({"code": "lookup"}, function (response) {
        document.getElementsByClassName("psbInvoerTekst")[1].value = response.courseCode;
        document.getElementsByClassName("psbLink")[0].click();
    });
}

else if (document.getElementsByClassName("OraTableContent").length > 0) {
    exams = [];
    rows = document.getElementsByClassName("OraTableContent")[0].children[0].children;
    for (index = 1; index < rows.length; index++) {
        row = rows[index].children;
        exams.push({
            "index": index,
            "courseCode": row[2].children[0].innerText,
            "courseName": row[4].children[0].innerText,
            "exam": row[7].children[0].innerText,
            "year": row[10].children[0].innerText,
            "quarter": row[14].children[0].innerText,
            "opportunity": row[16].children[0].innerText,
            "date": row[19].children[0].innerText,
            "time": row[23].children[0].innerText
        });
    }

    chrome.runtime.sendMessage({"code": "exams", "exams": exams}, function(response) {
        response.selected.forEach(function(index) {
            rows[index].children[0].children[0].click();
        });
        // TODO: Register for exams within the selected indices by actually clicking the button,
        //  instead of the return button.
        document.querySelectorAll("button")[4].click();
    });
}
// Else, return to the search page.
else {
    chrome.runtime.sendMessage({"code": "done"});
    document.querySelectorAll("button")[4].click();
}
