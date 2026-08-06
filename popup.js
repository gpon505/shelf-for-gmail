// Shelf toolbar popup: quick help + links.
document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
// Hard-coded store item id, NOT chrome.runtime.id: an unpacked install (how
// Shelf is developed) gets a path-derived id that isn't in the store, so the
// link 404s to "This item is not available" on every dev build.
document.getElementById('review').href =
  'https://chromewebstore.google.com/detail/dgomdjjoogkknnggfbggcdnlogkhdpng/reviews';
