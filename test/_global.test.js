import sinonMiddleware from 'sinon-chai'

import * as chai from 'chai'

global.expect = chai.expect

chai.use(sinonMiddleware)
