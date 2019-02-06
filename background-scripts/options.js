$(function () {
    chrome.storage.sync.get(null, function (values) {
        updateFields(values);
    });

    $("#defaultNormal").click(function () {
        chrome.storage.sync.set({"defaultNormal": $("#defaultNormal").prop("checked")});
    });
    $("#defaultResit").click(function () {
        chrome.storage.sync.set({"defaultResit": $("#defaultResit").prop("checked")});
    });

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        updateFields(changes)
    });

    $("#clear").click(function () {
        chrome.storage.sync.clear();
        chrome.storage.sync.set({
            "defaultNormal": false,
            "defaultResit": false
        })
    });

    $("#dummy").click(function () {
        chrome.storage.sync.set({
            "exams": [{
                "courseCode": "testCode",
                "courseName": "testName",
                "year": "2018",
                "quarter": 3,
                "opportunity": "2",
                "date": "13/03/2019",
                "time": "18.30 - 21.30",
                "registered": true
            }],
            "courses": [{
                "courseCode": "testCode",
                "courseName": "testName"
            }],
            "defaultNormal": true,
            "defaultResit": false
        });
    });
});

function updateFields(changes) {
    chrome.storage.sync.get(null, function (values) {
        for (var key in changes) {
            switch (key) {
                case "defaultNormal":
                    $("#defaultNormal").prop("checked", "defaultNormal" in values ? values.defaultNormal : false);
                    updateCourses(values);
                    break;
                case "defaultResit":
                    $("#defaultResit").prop("checked", "defaultResit" in values ? values.defaultResit : false);
                    updateCourses(values);
                    break;
                case "courses":
                    updateCourses(values);
                    break;
                case "exams":
                    updateExams(values);
            }
        }
    });
}

function updateCourses(values) {
    courseTable = $("#courses");
    courseTable.empty();
    var courses = "courses" in values ? values.courses : [];
    courses = courses.sort(function (a, b) {
        return a.courseName.localeCompare(b.courseName);
    });

    courses.forEach(function (course, index) {
        var markup = "<tr><th>" + course.courseCode + "</th>" +
            "<th> " + course.courseName + "</th>" +
            "<th><input type='checkbox' id = \"" + course.courseCode + "-normal\" /></th>" +
            "<th><input type='checkbox' id = \"" + course.courseCode + "-resit\" /></th></tr>";
        courseTable.append(markup);

        var normalButton = $("#" + course.courseCode + "-normal");
        normalButton.prop("checked", "normal" in course ? course.normal : values.defaultNormal);
        normalButton.click(function () {
            course["normal"] = normalButton.prop("checked");
            values.courses[index] = course;
            chrome.storage.sync.set(values);
        });

        var resitButton = $("#" + course.courseCode + "-resit");
        resitButton.prop("checked", "resit" in course ? course.resit : values.defaultResit);
        resitButton.click(function () {
            course["resit"] = resitButton.prop("checked");
            values.courses[index] = course;
            chrome.storage.sync.set(values);
        });
    });
}

function updateExams(values) {
    examTable = $("#exams");
    examTable.empty();
    var exams = "exams" in values ? values.exams : [];
    exams = exams.sort(function (a, b) {
        return a.courseName.localeCompare(b.courseName);
    });
    exams.forEach(function (exam, index) {
        var opportunity = exam.opportunity === "1" ? "First Attempt" : "Resit";
        var markup = "<tr><th>" + exam.courseCode + "</th>" +
            "<th> " + exam.courseName + "</th>" +
            "<th> " + exam.date + " " + exam.time + " </th>" +
            "<th> " + opportunity + "</th>" +
            "<th><input type='checkbox' id = \"" + (exam.date + exam.time).replace(/[\/,\ ,.,\-]/g, "") + "\" /></th></tr>";
        examTable.append(markup);
        var button = $("#" + (exam.date + exam.time).replace(/[\/,\ ,.,\-]/g, ""));
        button.prop("checked", exam.registered);
        button.click(function () {
            exam["registered"] = button.prop("checked");
            values.exams[index] = exam;
            chrome.storage.sync.set(values);
        });
    });
}