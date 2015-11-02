
var Router = require('..')
var utils = require('./support/utils')
var after = require('after')
var Promise = require('es6-promise').Promise

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createErrorHitHandle = utils.createErrorHitHandle
var shouldHitHandle = utils.shouldHitHandle
var shouldNotHitHandle = utils.shouldNotHitHandle
var createServer = utils.createServer
var request = utils.request

describe('Promise', function () {
  it('rejecting will trigger error handlers', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(createHitHandle(1))

    router.use(function (req, res) {
      return new Promise(function (resolve, reject) {
        reject(new Error('Happy error'))
      })
    })

    router.use(createHitHandle(2))
    router.use(createErrorHitHandle(3))

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldNotHitHandle(2))
    .expect(shouldHitHandle(3))
    .expect(500, done)
  })

  it('will be ignored if next is called', function (done) {
    var router = Router()
    var server = createServer(router)
    var timeoutCalled = false

    router.use(createHitHandle(1), function (req, res, next) {
      return new Promise(function (resolve, reject) {
        next()
        setTimeout(function () {
          timeoutCalled = true
          resolve()
        }, 5)
      })
    })

    router.use(createHitHandle(2), function (req, res) {
      assert(!timeoutCalled)
      res.end('Awesome!')
    })

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(200, done)
  })

  it('can be used in error handlers', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(createHitHandle(1), function (req, res, next) {
      next(new Error('Happy error'))
    })

    router.use(createErrorHitHandle(2), function (error, req, res, next) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          next(error)
          resolve()
        }, 5)
      })
    })

    router.use(function () {
      done(new Error('This should never be reached'))
    })

    router.use(createErrorHitHandle(3), function (error, req, res, next) {
      res.end('Awesome!')
    })

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(shouldHitHandle(3))
    .expect(200, done)
  })

  it('can be used in param functions', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(createHitHandle(1))

    router.param('param', function () {
      return new Promise(function (resolve, reject) {
        reject(new Error('Happy error'))
      })
    })

    router.use(createHitHandle(2))

    router.get('/:param', function (req, res) {
      res.end('yay')
    })

    router.use(createErrorHitHandle(3))

    request(server)
    .get('/asd')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(shouldHitHandle(3))
    .expect(500, done)
  })

  describe('from next', function () {
    it('will be returned', function (done) {
      var router = Router()
      var server = createServer(router)
      done = after(2, done)

      router.use(createHitHandle(1))

      router.use(function (req, res, next) {
        var result = next()
        assert(result.then, 'next() is thenable')
        done()
      })

      router.use(createHitHandle(2))

      router.use(function (req, res) {
        res.end('done')
      })

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(200, 'done', done)
    })

    it('will resolve when all handles are done', function (done) {
      var router = Router()
      var server = createServer(router)
      done = after(2, done)

      router.use(createHitHandle(1))

      router.use(function (req, res, next) {
        return next().then(function () {
          res.end('done')
          done()
        })
      })

      router.use(createHitHandle(2))

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(200, 'done', done)
    })

    it('can be used as an alternate error handler', function (done) {
      var router = Router()
      var server = createServer(router)
      done = after(2, done)

      router.use(createHitHandle(1))

      router.use(function (req, res, next) {
        return next().catch(function (err) {
          assert(err.message.match(/some error/i), 'Catches correct error')
          res.end('done')
          done()
        })
      })

      router.use(createHitHandle(2))
      router.use(function (req, res, next) { next(new Error('Some error')) })
      router.use(createErrorHitHandle(3))

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(shouldHitHandle(3))
      .expect(200, 'done', done)
    })

    it('will not resolve if the stack is not exhausted', function (done) {
      var router = Router()
      var server = createServer(router)

      router.use(createHitHandle(1))

      router.use(function (req, res, next) {
        return next().then(function () {
          done(new Error('This should never be called'))
        })
      })

      router.use(createHitHandle(2))

      router.use(function (req, res) {
        res.end('done')
      })

      router.use(createHitHandle(3))

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(shouldNotHitHandle(3))
      .expect(200, 'done', done)
    })
  })
})
