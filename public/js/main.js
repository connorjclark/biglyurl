document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('bigifier').addEventListener('submit', function(e){
      e.preventDefault();

      var url = document.getElementById('url').value

      if (url.indexOf('http://') === -1 && url.indexOf('https://') === -1) {
        alert('url must start with http:// or https://');
        return;
      }

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/biglyfy');
      xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      xhr.send('url=' + url);

      xhr.onreadystatechange = function () {
        var DONE = 4;
        
        if (xhr.readyState === DONE) {
          if (xhr.status === 200) {
            document.getElementById('biglyfied').textContent = xhr.responseText;
          } else {
            console.error('Error: ' + xhr.status);
          }
        }
      };
  });
});
