import sinon from 'sinon'

import { expect } from '@open-wc/testing'

import {
  required,
  requiredIf,
  min,
  max,
  range,
} from '../src/validators'

describe.only('validators', () => {
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('required()', () => {
    const validator = v => Boolean(required().validate(v))

    it('fails when an empty value is provided', () =>
      expect(validator('')).to.be.false)

    it('fails when value is an empty array', () =>
      expect(validator([])).to.be.true)

    it('passes when a value is provided', () =>
      expect(validator('asdf')).to.be.true)

    it('passes when the array is non-empty', () =>
      expect(validator(['asdf'])).to.be.true)
  })

  describe('requiredIf()', () => {
    const NUMBER = '(702) 555-1234'
    const ERROR = { type: 'Required' }

    const validator = requiredIf('number', 'type')
    const validate = item => Boolean(validator.validate(item))

    it('provides the correct error shape', () =>
      expect(validator.error).to.be.eql(ERROR))

    it('fails when only the primary field is truthy', () =>
      expect(validate({ number: NUMBER, type: '' })).to.be.false)

    it('passes when only the secondary field is truthy', () =>
      expect(validate({ number: '', type: 'Home' })).to.be.true)

    it('passes when both fields are truthy', () =>
      expect(validate({ number: NUMBER, type: 'Home' })).to.be.true)

    it('passes when both fields are falsy', () =>
      expect(validate({ number: '', type: '' })).to.be.true)
  })

  describe('min()', () => {
    const validate = (v, inclusive) => min(0, inclusive).validate(v)

    it('fails when value is below min (INC)', () =>
      expect(validate(-10, true)).to.be.false)

    it('fails when value is below min (EXC)', () =>
      expect(validate(-10, false)).to.be.false)

    it('fails when value is equal to min (EXC)', () =>
      expect(validate(0, false)).to.be.false)

    it('passes when value is equal to min (INC)', () =>
      expect(validate(0)).to.be.true)

    it('passes when the value is empty', () =>
      expect(validate('')).to.be.true)
  })

  describe('max()', () => {
    const validate = (v, incMax) => max(100, incMax).validate(v)

    it('fails when value is above max (INC)', () =>
      expect(validate(110, true)).to.be.false)

    it('fails when value is above max (EXC)', () =>
      expect(validate(110, false)).to.be.false)

    it('fails when value is equal to max (EXC)', () =>
      expect(validate(100, false)).to.be.false)

    it('passes when value is equal to max (INC)', () =>
      expect(validate(100)).to.be.true)

    it('passes when the value is empty', () =>
      expect(validate('')).to.be.true)
  })

  describe('range()', () => {
    const validate = (v, incMin, incMax) =>
      range(0, 100, incMin, incMax).validate(v)

    it('fails when value is below min (INC)', () =>
      expect(validate(-10, true, true)).to.be.false)

    it('fails when value is above max (INC)', () =>
      expect(validate(110, true, true)).to.be.false)

    it('fails when value is below min (EXC)', () =>
      expect(validate(-10, false, false)).to.be.false)

    it('fails when value is above max (EXC)', () =>
      expect(validate(110, false, false)).to.be.false)

    it('fails when value is equal to min (EXC)', () =>
      expect(validate(0, false, false)).to.be.false)

    it('fails when value is equal to max (EXC)', () =>
      expect(validate(100, false, false)).to.be.false)

    it('passes when value is equal to min (INC)', () =>
      expect(validate(0)).to.be.true)

    it('passes when value is equal to max (INC)', () =>
      expect(validate(100)).to.be.true)

    it('passes when value is within min and max', () =>
      expect(validate(50)).to.be.true)

    it('passes when the value is empty', () =>
      expect(validate('')).to.be.true)
  })
})
