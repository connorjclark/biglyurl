var http = require('http')
var fs = require('fs')

http.createServer(function (req, res) {
  var data = null

  if (req.url !== '/' && fs.existsSync('dist' + req.url)) {
    data = fs.readFileSync('dist' + req.url)
  } else {
    data = fs.readFileSync('dist/index.html')
  }

  if (data) {
    res.writeHead(200)
    res.write(data)
  } else {
    res.writeHead(404)
  }

  res.end()
}).listen(8080)
