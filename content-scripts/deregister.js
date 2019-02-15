if (document.getElementsByClassName("OraError").length > 0) {
    chrome.runtime.sendMessage({phase: "error", message: document.getElementsByClassName("psbError")[0].innerText});
}

// When there is a confirmation button, click this.
if (document.getElementById("confirmButton1")) {
    chrome.runtime.sendMessage({phase: "confirm"}, function () {
        document.getElementById("confirmButton1").click();
    });
}

// If we can select exams and there is no error, send all exams and click the ones that have to be selected.
else if (document.getElementsByClassName("OraTableContent").length > 1 && document.getElementsByClassName("OraError").length === 0) {
    var rows = document.getElementsByClassName("OraTableContent")[0].children[0].children;
    chrome.runtime.sendMessage({"phase": "lookup", "exams": parseExams(rows)}, function (response) {
        if (response.indices.length > 0) {
            response.indices.forEach(function (index) {
                rows[index].children[0].children[0].click();
            });
            document.getElementsByClassName("psbButtonLink")[0].click();
        } else {
            chrome.runtime.sendMessage({phase: "done"});
        }
    });
}

// Execution is done.
else {
    chrome.runtime.sendMessage({phase: "done"});
}


/**
 * Parse the exams from a given array of rows.
 * @param rows      The rows of the table, which has available exams in it.
 * @returns {Array} An array of exam objects.
 */
function parseExams(rows) {
    var exams = [];
    for (index = 1; index < rows.length; index++) {
        row = rows[index].children;
        exams.push({
            "index": index,
            "courseCode": row[1].innerText,
            "courseName": row[3].innerText,
            "exam": row[15].innerText,
            "year": row[7].innerText,
            "quarter": row[17].innerText,
            "opportunity": row[19].innerText,
            "date": row[21].innerText,
            "time": row[23].innerText
        });
    }
    return exams;
}