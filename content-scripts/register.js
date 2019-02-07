if (window.location.href.includes("https://osistud.tudelft.nl/osiris_student/InschrijvenToets.do")) {
    chrome.runtime.sendMessage({phase: "done"});
}
else if (document.getElementsByClassName("psbInvoerTekst").length > 0) {
    chrome.runtime.sendMessage({phase: "courseLookup"}, function (response) {
        document.getElementsByClassName("psbInvoerTekst")[1].value = response.courseCode;
        document.getElementsByClassName("psbLink")[0].click();
    });
}
else if (document.getElementsByClassName("OraTableContent").length > 0) {
    var rows = document.getElementsByClassName("OraTableContent")[0].children[0].children;
    chrome.runtime.sendMessage({phase: "lookup", exams: parseExams(rows)}, function(response) {
        response.indices.forEach(function(index) {
            rows[index].children[0].children[0].children[0].click();
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
    return exams;
}