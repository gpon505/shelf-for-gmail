// Shelf toolbar popup: quick help + links.
document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
// Literal store id rather than chrome.runtime.id — see the STORE_REVIEW_URL
// note in content.js. Keep the two in sync if the listing ever moves.
document.getElementById('review').href =
  'https://chromewebstore.google.com/detail/dgomdjjoogkknnggfbggcdnlogkhdpng/reviews';
