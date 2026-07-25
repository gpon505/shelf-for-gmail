// Shelf toolbar popup: quick help + links.
document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
document.getElementById('review').href =
  'https://chromewebstore.google.com/detail/' + chrome.runtime.id + '/reviews';
