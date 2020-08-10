import sinon from 'sinon'

import { expect } from 'chai'

import { getValueByPath } from '../src/utils'

import {
  isRequired,
  isRequiredIf,
  isPropRequired,
  isSsn,
  isDate,
  isDateBefore,
  isDateAfter,
  isEmailAddress,
  isPhoneNumber,
  isPostalCode,
  hasLength,
  hasDuplicate,
  atMin,
  atMax,
  inRange,
} from '../src/validators'

const ERROR_CUSTOM = 'Custom error'

describe('validators', () => {
  let sandbox
  let validator

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('isRequired()', () => {
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isRequired()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Required'))

    it('fails when an empty value is provided', () =>
      expect(validate('')).to.be.false)

    it('fails when value is an empty array', () =>
      expect(validate([])).to.be.false)

    it('passes when a value is provided', () =>
      expect(validate('asdf')).to.be.true)

    it('passes when the array is non-empty', () =>
      expect(validate(['asdf'])).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isRequired(ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isRequiredIf()', () => {
    let service

    const NUMBER = '(702) 555-1234'
    const TYPE = 'Home'
    const validate = (number, type) =>
      Boolean(validator.validate(type, ['type'], { number, type }, service))

    beforeEach(() => {
      validator = isRequiredIf('number')
      service = { validateKey: sinon.stub() }
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Required'))

    it('fails when only when dependency field is truthy', () =>
      expect(validate(NUMBER, '')).to.be.false)

    it('passes when only the secondary field is truthy', () =>
      expect(validate('', TYPE)).to.be.true)

    it('passes when both fields are truthy', () =>
      expect(validate(NUMBER, TYPE)).to.be.true)

    it('passes when both fields are falsy', () =>
      expect(validate('', '')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isRequiredIf('number', true, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })

    context('when auto validating', () => {
      const ERROR = 'Custom error'

      beforeEach(() => {
        validator = isRequiredIf('number', true, ERROR)

        validate(NUMBER, '')
      })

      it('sets error', () =>
        expect(validator.error).to.be.eq(ERROR))

      it('validates the other key', () =>
        expect(service.validateKey).to.be.calledOnceWith(['number']))
    })

    context('when NOT auto validating', () => {
      beforeEach(() => {
        validator = isRequiredIf('number', false)

        validate(NUMBER, '')
      })

      it('does not validate other key', () =>
        expect(service.validateKey).to.not.be.called)
    })
  })

  describe('isPropRequired()', () => {
    const validate = v => Boolean(validator.validate(v))

    const EMPTY = {
      label: 'None',
      data: { id: '' },
    }

    const ITEM = {
      label: 'Item One',
      data: { id: '1' },
    }

    beforeEach(() => {
      validator = isPropRequired('data.id')
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Required'))

    it('fails when an empty value is provided to sub-property', () =>
      expect(validate(EMPTY)).to.be.false)

    it('passes when a value is provided', () =>
      expect(validate(ITEM)).to.be.true)

    context('when the sub-property is an array', () => {
      const EMPTY = {
        label: 'None',
        data: [],
      }

      const ITEM = {
        label: 'Item One',
        data: ['1'],
      }

      beforeEach(() => {
        validator = isPropRequired('data')
      })

      it('fails when value is an empty array', () =>
        expect(validate(EMPTY)).to.be.false)

      it('passes when the array is non-empty', () =>
        expect(validate(ITEM)).to.be.true)
    })

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isPropRequired('', ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isSsn()', () => {
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isSsn()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('###-##-####'))

    it('fails when an invalid string is provided', () =>
      expect(validate('asdf')).to.be.false)

    it('passes when a valid string is provided', () =>
      expect(validate('504-11-2222')).to.be.true)

    it('passes when an empty value is provided', () =>
      expect(validate('')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isSsn(ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isDate()', () => {
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isDate()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('mm/dd/yyyy'))

    it('fails when invalid characters are provided', () =>
      expect(validate('asdf')).to.be.false)

    it('fails when an valid and invalid characters are provided', () =>
      expect(validate('asdf10')).to.be.false)

    it('fails when a partial string is provided', () =>
      expect(validate('10/')).to.be.false)

    it('fails when an invalid range is provided', () =>
      expect(validate('10/34')).to.be.false)

    it('passes when a valid string is provided', () =>
      expect(validate('10/15/1989')).to.be.true)

    it('passes when an empty value is provided', () =>
      expect(validate('')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isDate('mm/dd/yyyy', ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isDateBefore()', () => {
    const TARGET = '2000-01-01'
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isDateBefore(TARGET)
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Date is too late'))

    it('fails when an invalid string is provided', () =>
      expect(validate('asdf')).to.be.false)

    it('fails when a date is later than target', () =>
      expect(validate('01/02/2000')).to.be.false)

    it('passes when an empty value is provided', () =>
      expect(validate('')).to.be.true)

    it('passes when a valid date is provided', () =>
      expect(validate('01/01/1970')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isDateBefore(TARGET, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isDateAfter()', () => {
    const TARGET = '2000-01-01'
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isDateAfter(TARGET)
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Date is too early'))

    it('fails when an invalid string is provided', () =>
      expect(validate('asdf')).to.be.false)

    it('fails when a date is earlier than target', () =>
      expect(validate('12/31/1999')).to.be.false)

    it('passes when an empty value is provided', () =>
      expect(validate('')).to.be.true)

    it('passes when a valid date is provided', () =>
      expect(validate('01/02/2000')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isDateAfter(TARGET, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isEmailAddress()', () => {
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isEmailAddress()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Invalid email'))

    it('fails when an invalid string is provided', () =>
      expect(validate('asdf')).to.be.false)

    it('passes when a valid string is provided', () =>
      expect(validate('support@chirotouch.com')).to.be.true)

    it('passes when an empty value is provided', () =>
      expect(validate('')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isEmailAddress(ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isPhoneNumber()', () => {
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isPhoneNumber()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Invalid phone number'))

    it('fails when an invalid string is provided', () =>
      expect(validate('asdf')).to.be.false)

    it('passes when no number is provided', () =>
      expect(validate('')).to.be.true)

    it('passes when a valid string is provided', () =>
      expect(validate('(702) 555-1234')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isPhoneNumber(ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('isPostalCode()', () => {
    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = isPostalCode()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Invalid Postal Code'))

    it('fails when an invalid postal code is provided', () =>
      expect(validate('asdf')).to.be.false)

    it('passes when a valid postal code is provided', () =>
      expect(validate('89119')).to.be.true)

    it('passes when an empty value is provided', () =>
      expect(validate('')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = isPostalCode('US', ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('hasLength()', () => {
    const LENGTH = 3
    const ERROR = 'Must be 3 characters'
    const VALUE_INVALID = 'asdf'
    const VALUE_VALID = 'asd'

    const validate = v => Boolean(validator.validate(v))

    beforeEach(() => {
      validator = hasLength(LENGTH)
    })

    it('provides the correct error', () =>
      expect(validator.error).to.be.eql(ERROR))

    it('fails when value is invalid length', () =>
      expect(validate(VALUE_INVALID)).to.be.false)

    it('passes when no length', () =>
      expect(validate('')).to.be.true)

    it('passes when value has correct length', () =>
      expect(validate(VALUE_VALID)).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = hasLength(LENGTH, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('hasDuplicate()', () => {
    const ITEMS_DUPLICATE = ['123', '123', '456'].map(id => ({ id }))
    const ITEMS_UNIQUE = ['Ed', 'Edd', 'Eddy'].map(name => ({ name }))

    const validate = (items, path) => {
      const keyPath = path.split('.')
      const v = getValueByPath(items, keyPath)

      return Boolean(validator.validate(v, keyPath, items))
    }

    beforeEach(() => {
      validator = hasDuplicate()
    })

    it('sets the error message (for code coverage)', () =>
      expect(validator.error).to.be.eq('Duplicate'))

    it('fails when the target value is equal to other element kvp', () =>
      expect(validate(ITEMS_DUPLICATE, '0.id')).to.be.false)

    it('passes when the target value is NOT equal to other element kvp', () =>
      expect(validate(ITEMS_UNIQUE, '0.name')).to.be.true)

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = hasDuplicate(ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('atMin()', () => {
    const validate = (v, inclusive) => atMin(0, inclusive).validate(v)

    it('sets the error message (for code coverage)', () =>
      expect(atMin(0).error).to.be.true)

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

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = atMin(0, false, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('atMax()', () => {
    const validate = (v, inclusive) => atMax(100, inclusive).validate(v)

    it('sets the error message (for code coverage)', () =>
      expect(atMax(0).error).to.be.true)

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

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = atMax(0, false, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })

  describe('inRange()', () => {
    const validate = (v, incMin, incMax) =>
      inRange(0, 100, incMin, incMax).validate(v)

      it('sets the error message (for code coverage)', () =>
      expect(inRange(0, 100).error).to.be.eq('0 - 100'))

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

    context('when a custom error is provided', () => {
      beforeEach(() => {
        validator = inRange(0, 100, false, false, ERROR_CUSTOM)
      })

      it('sets the error message', () =>
        expect(validator.error).to.be.eq(ERROR_CUSTOM))
    })
  })
})
