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
        let normalButtonId = course.courseCode + "-normal";
        let resitButtonId = course.courseCode + "-resit";
        courseTable.append($("<tr>")
            .append($("<th>")
                .text(course.courseCode))
            .append($("<th>")
                .text(course.courseName))
            .append($("<th>")
                .attr("id", normalButtonId)
                .append($("<button>")
                    .attr("id", normalButtonId + "0")
                    .text("No"))
                .append($("<button>")
                    .attr("id", normalButtonId + "1")
                    .text("Yes"))
                .append($("<button>")
                    .attr("id", normalButtonId + "2")
                    .text("Default")))
            .append($("<th>")
                .attr("id", resitButtonId)
                .append($("<button>")
                    .attr("id", resitButtonId + "0")
                    .text("No"))
                .append($("<button>")
                    .attr("id", resitButtonId + "1")
                    .text("Yes"))
                .append($("<button>")
                    .attr("id", resitButtonId + "2")
                    .text("Default")))
        );


        $("#" + normalButtonId + course.normal).css('border-style', 'inset').attr('disabled', 'disabled');
        $("#" + resitButtonId + course.resit).css('border-style', 'inset').attr('disabled', 'disabled');

        $("#" + normalButtonId).click(function (event) {
            for (var i = 0; i < this.children.length; i++) {
                if (this.children[i] === event.target) {
                    $("#" + event.target.id).css('border-style', 'inset').attr('disabled', 'disabled');
                    course["normal"] = i;
                    values.courses[index] = course;
                    chrome.storage.sync.set(values);
                } else {
                    $("#" + this.children[i].id).css('border-style', 'outset').removeAttr('disabled');
                }
            }
        });

        $("#" + resitButtonId).click(function (event) {
            for (var i = 0; i < this.children.length; i++) {
                if (this.children[i] === event.target) {
                    $("#" + event.target.id).css('border-style', 'inset').attr('disabled', 'disabled');
                    course["resit"] = i;
                    values.courses[index] = course;
                    chrome.storage.sync.set(values);
                } else {
                    $("#" + this.children[i].id).css('border-style', 'outset').removeAttr('disabled');
                }
            }
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
        examTable.append($('<tr>')
            .append($('<th>')
                .text(exam.courseCode))
            .append($('<th>')
                .text(exam.courseName))
            .append($('<th>')
                .text(exam.date + " " + exam.time))
            .append($('<th>')
                .text(exam.opportunity === "1" ? "First Attempt" : "Resit"))
            .append($('<th>')
                .append($('<button>')
                    .attr('type', 'button')
                    .attr('id', (exam.date + exam.time).replace(/[\/ .\-]/g, ""))
                    .css('background-color', exam.registered ? "#d0ff6b" : "#ff6a6a")
                    .text(exam.registered ? "Yes" : "No")))
        );
        var button = $("#" + (exam.date + exam.time).replace(/[\/ .\-]/g, ""));
        button.click(function () {
            button.attr('disabled', 'disabled').text("Processing...").css('background-color', '#777777').css('color', 'white');
            chrome.runtime.sendMessage({
                function: exam.registered ? "deregister" : "register",
                courseCode: exam.courseCode,
                exam: exam
            });
        });
    });
}