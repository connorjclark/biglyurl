import bigly from './bigly'

function run () {
  var domain = window.location.protocol + '//' + window.location.host

  bigly.load(domain, function (err, big) {
    if (err) throw err

    if (window.location.pathname !== '/') {
      // decode and redirect
      window.location = big.smallify(window.location.href)
    } else {
      document.getElementById('bigifier').addEventListener('submit', function (e) {
        e.preventDefault()
        var url = document.getElementById('url').value

        if (url.indexOf('http://') === -1 && url.indexOf('https://') === -1) {
          url = 'http://' + url
        }

        document.getElementById('bigified').textContent = big.bigify(url)
      })
    }
  })
}

export default {
  run
}
