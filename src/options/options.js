const debug = false;
$(function() {
  // Set the current version from the manifest in the footer.
  $('#version').text('OsiRegisterer v' + chrome.runtime.getManifest().version);

  // Update the tables with the current values.
  chrome.storage.sync.get(null, function(values) {
    updateFields(values);
  });

  $('#defaultNormal').click(function() {
    chrome.storage.sync.set({'defaultNormal': $('#defaultNormal').prop('checked')});
  });

  $('#defaultResit').click(function() {
    chrome.storage.sync.set({'defaultResit': $('#defaultResit').prop('checked')});
  });

  $('#defaultStartup').click(function() {
    chrome.storage.sync.set({'defaultStartup': $('#defaultStartup').prop('checked')});
  });

  chrome.storage.onChanged.addListener(function(changes, areaName) {
    updateFields(changes);
  });

  if (debug) {
    $('#debugOptions')
        .append($('<button>')
            .text('Clear Storage')
            .click(function() {
              chrome.storage.sync.clear();
            }))
        .append($('<button>')
            .text('Clear Courses')
            .click(function() {
              chrome.storage.sync.set({courses: []});
            }))
        .append($('<button>')
            .text('Clear Exams')
            .click(function() {
              chrome.storage.sync.set({exams: []});
            }));
  }
});

/**
 * Update all fields on the settings page.
 *
 * @param {Object} changes The last changes made to the storage.
 */
function updateFields(changes) {
  chrome.storage.sync.get(null, function(values) {
    for (const key in changes) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) {
        switch (key) {
          case 'defaultNormal':
            $('#defaultNormal').prop('checked', 'defaultNormal' in values ? values.defaultNormal : false);
            updateCourses(values);
            break;
          case 'defaultResit':
            $('#defaultResit').prop('checked', 'defaultResit' in values ? values.defaultResit : false);
            updateCourses(values);
            break;
          case 'defaultStartup':
            $('#defaultStartup').prop('checked', 'defaultStartup' in values ? values.defaultStartup : false);
            break;
          case 'courses':
            updateCourses(values);
            break;
          case 'exams': {
            const activeExams = removeExpiredExams(values);
            updateExams(values);
            chrome.storage.sync.set({exams: activeExams});
          }
        }
      }
    }
  });
}

/**
 * Removes the expired exams from the values.exams and returns this.
 *
 * @param {Object.<exams>}values  The saved exams in the storage
 * @return {array}                The exams which are still active (which occur later than today).
 */
function removeExpiredExams(values) {
  const exams = 'exams' in values ? values.exams : [];
  const today = new Date();
  for (let index = 0; index < exams.length; index++) {
    const exam = exams[index];
    const splitExamDate = exam.date.split('/');
    const examDate = new Date(splitExamDate[2], parseInt(splitExamDate[1]) - 1, splitExamDate[0]);
    if (today > examDate) {
      exams.splice(index);
    }
  }
  return exams;
}

/**
 * Update the courses table.
 *
 * @param {Object.<courses>} values The saved courses in the storage.
 */
function updateCourses(values) {
  const courseTable = $('#courses');
  courseTable.empty();
  let courses = 'courses' in values ? values.courses : [];
  courses = courses.sort(function(a, b) {
    return a.courseName.localeCompare(b.courseName);
  });

  courses.forEach(function(course, index) {
    const normalButtonId = course.courseCode + '-normal';
    const resitButtonId = course.courseCode + '-resit';
    courseTable.append($('<tr>')
        .append($('<th>')
            .text(course.courseCode))
        .append($('<th>')
            .text(course.courseName))
        .append($('<th>')
            .attr('id', normalButtonId)
            .append($('<button>')
                .attr('id', normalButtonId + '0')
                .text('No'))
            .append($('<button>')
                .attr('id', normalButtonId + '1')
                .text('Yes'))
            .append($('<button>')
                .attr('id', normalButtonId + '2')
                .text('Default')))
        .append($('<th>')
            .attr('id', resitButtonId)
            .append($('<button>')
                .attr('id', resitButtonId + '0')
                .text('No'))
            .append($('<button>')
                .attr('id', resitButtonId + '1')
                .text('Yes'))
            .append($('<button>')
                .attr('id', resitButtonId + '2')
                .text('Default'))),
    );


    $('#' + normalButtonId + course.normal).attr('disabled', 'disabled');
    $('#' + resitButtonId + course.resit).attr('disabled', 'disabled');

    const normalButtonArea = $('#' + normalButtonId);
    normalButtonArea.click(function(event) {
      if (event.target.id !== normalButtonId) {
        const children = normalButtonArea.children();
        for (let i = 0; i < children.length; i++) {
          if (children[i].id === event.target.id) {
            $('#' + event.target.id).attr('disabled', 'disabled');
            course['normal'] = i;
            values.courses[index] = course;
            chrome.storage.sync.set(values);
          } else {
            $('#' + children[i].id).removeAttr('disabled');
          }
        }
      }
    });

    const resitButtonArea = $('#' + resitButtonId);
    resitButtonArea.click(function(event) {
      if (event.target.id !== resitButtonId) {
        const children = resitButtonArea.children();
        for (let i = 0; i < children.length; i++) {
          if (children[i].id === event.target.id) {
            $('#' + event.target.id).attr('disabled', 'disabled');
            course['resit'] = i;
            values.courses[index] = course;
            chrome.storage.sync.set(values);
          } else {
            $('#' + children[i].id).removeAttr('disabled');
          }
        }
      }
    });
  });
}

/**
 * Update the exam table.
 *
 * @param {Object<exams>} values the saved values from the storage.
 */
function updateExams(values) {
  const examTable = $('#exams');
  examTable.empty();
  let exams = 'exams' in values ? values.exams : [];
  exams = exams.sort(function(a, b) {
    return a.courseName.localeCompare(b.courseName);
  });
  exams.forEach(function(exam, index) {
    examTable.append($('<tr>')
        .append($('<th>')
            .text(exam.courseCode))
        .append($('<th>')
            .text(exam.courseName))
        .append($('<th>')
            .text(exam.date + ' ' + exam.time))
        .append($('<th>')
            .text(exam.opportunity === '1' ? 'First Attempt' : 'Resit'))
        .append($('<th>')
            .append($('<button>')
                .attr('type', 'button')
                .attr('id', (exam.date + exam.time).replace(/[/ .-]/g, ''))
                .css('background-color', exam.registered ? '#d0ff6b' : '#ff6a6a')
                .text(exam.registered ? 'Yes' : 'No'))),
    );
    const button = $('#' + (exam.date + exam.time).replace(/[/ .-]/g, ''));
    button.click(function() {
      button.attr('disabled', 'disabled')
          .text('Processing...')
          .css('background-color', '#777777')
          .css('color', 'white');
      chrome.runtime.sendMessage({
        function: exam.registered ? 'deregister' : 'register',
        courseCode: exam.courseCode,
        exam: exam,
      });
    });
  });
}
