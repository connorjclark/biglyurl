document.addEventListener('DOMContentLoaded', function() {
  const bigify = window.bigly.lib.bigify;
  const smallify = window.bigly.lib.smallify
  const origin = window.location.origin;
  if (window.location.search.startsWith('?huuuuuuuge=')) {
    const encoded = window.location.search;
    const decoded = smallify(origin, encoded);
    if (bigify(origin, decoded).big !== origin + encoded) {
      throw new Error('bad url');
    }
    window.location.href = decoded;
  }

  document.getElementById('bigifier').addEventListener('submit', function(e){
      e.preventDefault();

      let url = document.getElementById('url').value;

      if (url.indexOf('http') === -1) {
        url = 'https://' + url;
      }

      const result = bigify(origin, url);
      document.getElementById('biglyfied').textContent = result.big;
      document.getElementById('bigly-speech').textContent = result.speech;
      document.getElementById('bigly-copy-btn').disabled = false;
  });

  function copy() {
    document.getElementById('biglyfied').select();
    document.execCommand('copy');
  }
  document.getElementById('biglyfied').onclick = copy;
});
