$(function() {
  $('#updateCourses').click(function() {
    chrome.runtime.sendMessage({'function': 'updateCourses'});
  });

  $('#updateExams').click(function() {
    chrome.runtime.sendMessage({'function': 'updateExams'});
  });

  $('#settingsIcon').click(function() {
    chrome.runtime.openOptionsPage();
  });


  // Get version from the manifest into the footer.
  $('#version').text('OsiRegisterer v' + chrome.runtime.getManifest().version);
});
