if (document.getElementById("confirmButton1")) {
    chrome.runtime.sendMessage({phase: "confirm"}, function() {
        document.getElementById("confirmButton1").click();
    });
}
else if (document.getElementsByClassName("OraTableContent").length > 1 && document.getElementsByClassName("OraError").length === 0) {
    var rows = document.getElementsByClassName("OraTableContent")[0].children[0].children;
    chrome.runtime.sendMessage({"phase": "lookup", "exams": parseExams(rows)}, function(response) {
        response.indices.forEach(function(index) {
            rows[index].children[0].children[0].click();
        });
        document.getElementsByClassName("psbButtonLink")[0].click();
    });
}
else {
    chrome.runtime.sendMessage({phase: "done"});
}

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