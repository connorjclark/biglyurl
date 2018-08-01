import {encode, decode} from './bigly'
import * as express from 'express'
import * as path from 'path'
import * as favicon from 'serve-favicon'
import * as logger from 'morgan'
import * as cookieParser from 'cookie-parser'
import * as bodyParser from 'body-parser'

class ResponseError extends Error {
  status?: number
}

export const app: express.Application = express();

// view engine setup
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/biglyfy', (req: express.Request, res: express.Response) => {
  console.log(req.body)
  const host = req.protocol + '://' + req.get('host')
  res.send(encode(host, req.body.url || 'https://google.com'))
})

app.get('/v1.0.0/*', (req: express.Request, res: express.Response) => {
  const host = req.protocol + '://' + req.get('host')
  const url = decode(host, req.url)
  res.status(301).redirect(url)
})

// catch 404 and forward to error handler
app.use(function(req: express.Request, res: express.Response, next: express.NextFunction) {
  var err = new ResponseError('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err: ResponseError, req: express.Request, res: express.Response, next: express.NextFunction) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

export default app
