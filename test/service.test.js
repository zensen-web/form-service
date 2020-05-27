import sinon from 'sinon'

import { filterEmpty, padArray } from '../src/utils'
import { FormService } from '../src'
import { isPhoneNumber } from './validators'

import {
  required,
  requiredIf,
  range,
} from '../src/validators'

import {
  capitalize,
  toNumeric,
  toCurrency,
  toPhoneNumber,
} from './formatters'

const DATE = new Date(2020, 0, 1, 0, 0, 0, 0)
const MODIFIERS = ['ab', 'cd', 'ef', 'gh']

const SCHEMA_DEFAULTS = {
  pristine: true,
  errors: '',
}

const MODEL = {
  id: '123',
  taxId: null,
  active: true,
  procedure: '',
  description: '',
  amount: 19.99,
  purchaseDate: DATE,
  modifiers: MODIFIERS,
}

const STATE = {
  id: '123',
  taxId: null,
  active: true,
  procedure: '',
  description: '',
  amount: '$19.99',
  purchaseDate: DATE,
  modifiers: MODIFIERS,
}

const ERROR_SCHEMA = {
  id: '',
  taxId: '',
  active: '',
  procedure: '',
  description: '',
  amount: '',
  purchaseDate: '',
  modifiers: ['', '', '', ''],
}

describe('FormService', () => {
  let sandbox
  let service
  let requiredValidator
  let onChangeSpy

  const getLastChange = () => onChangeSpy.lastCall.args
  const buildService = input =>
    new FormService(
      input,
      {
        procedure: [requiredValidator],
        modifiers: {
          genItem: () => '',
        },
        amount: {
          format: v => toCurrency(v),
          unformat: v => toNumeric(v),
        },
      },
      onChangeSpy,
    )

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    onChangeSpy = sandbox.spy()

    requiredValidator = { ...required() }
  })

  afterEach(() => {
    sandbox.restore()
  })

  context('when converters are NOT provided', () => {
    beforeEach(() => {
      service = new FormService(MODEL, {}, onChangeSpy)
    })

    it('invokes onChange', () =>
      expect(getLastChange()).to.be.eql([false, MODEL, ERROR_SCHEMA]))
  })

  context('when converters are provided', () => {
    beforeEach(() => {
      service = buildService(MODEL)
    })

    it('produces a state with the proper conversions', () =>
      expect(service.__state).to.be.eql(STATE))

    context('when a change occurs', () => {
      const EXPECTED_MODEL = { ...MODEL, procedure: '' }
      const EXPECTED_STATE = { ...STATE, procedure: '' }
      const EXPECTED_ERRORS = { ...ERROR_SCHEMA, procedure: 'Required' }

      beforeEach(() => {
        service.apply('procedure', '')
      })

      it('invokes onChange', () =>
        expect(getLastChange()).to.be.eql([
          false,
          EXPECTED_STATE,
          ERROR_SCHEMA,
        ]))

      context('when an error is triggered', () => {
        const PROCEDURE_ERR_VAL = ''
        let requiredSpy

        beforeEach(() => {
          requiredSpy = sandbox.spy(requiredValidator, 'validate')
          service.apply('procedure', PROCEDURE_ERR_VAL)
        })

        it('has errors', () => expect(service.hasErrors).to.be.true)

        it('invokes onChange', () =>
          expect(getLastChange()).to.be.eql([
            false,
            EXPECTED_STATE,
            EXPECTED_ERRORS,
          ]))

        it('invokes the key validator', () =>
          expect(requiredSpy.withArgs(PROCEDURE_ERR_VAL)).to.be.calledOnce)

        context('when resetting', () => {
          beforeEach(() => {
            service.reset()
          })

          it('resets state', () =>
            expect(service.__state).to.be.eql(STATE))

          it('resets errors', () =>
            expect(service.hasErrors).to.be.false)
        })
      })

      context('when building the model from state', () => {
        let expectedValue

        beforeEach(() => {
          expectedValue = service.buildModel()
        })

        it('returns a converted version of the current state', () =>
          expect(expectedValue).to.be.eql(EXPECTED_MODEL))
      })
    })

    context('when modifying an item to an array', () => {
      const MODIFIER = 'sd'
      const EXPECTED = MODIFIERS.map((mod, index) =>
        (index === 2 ? MODIFIER : mod),
      )

      beforeEach(() => {
        service.apply('modifiers.2', MODIFIER)
      })

      it('modifies the correct element', () =>
        expect(service.__state.modifiers).to.be.eql(EXPECTED))
    })

    context('when adding an item to end of an array', () => {
      const EXPECTED = [...MODIFIERS, '']

      beforeEach(() => {
        service.addItem('modifiers')
      })

      it('adds it', () => expect(service.__state.modifiers).to.be.eql(EXPECTED))
    })

    context('when adding an item in the middle of an array', () => {
      const EXPECTED = ['ab', 'cd', '', 'ef', 'gh']

      beforeEach(() => {
        service.addItem('modifiers', 2)
      })

      it('adds it', () => expect(service.__state.modifiers).to.be.eql(EXPECTED))
    })

    context('when removing an item from the end of an array', () => {
      beforeEach(() => {
        service.apply('modifiers', ['ab', 'cd', 'ef', 'gh'])
        service.removeItem('modifiers')
      })

      it('removes it', () =>
        expect(service.__state.modifiers).to.be.eql(['ab', 'cd', 'ef']))
    })

    context('when removing an item to an array', () => {
      beforeEach(() => {
        service.apply('modifiers', ['ab', 'cd', 'ef', 'gh'])
        service.removeItem('modifiers', 0)
      })

      it('removes it', () =>
        expect(service.__state.modifiers).to.be.eql(['cd', 'ef', 'gh']))
    })
  })

  describe('schema clipping', () => {
    Object.entries(SCHEMA_DEFAULTS).forEach(([key, defaultValue]) => {
      const clipKey = `clip${capitalize(key)}`
      const propKey = `__${key}`

      context(`when clipping the ${key} schema`, () => {
        const MODEL = {
          id: '123',
          name: 'Test',
          type: {
            label: 'Default',
            value: null,
          },
        }

        const EXPECTED_RESULT = {
          id: defaultValue,
          name: defaultValue,
          type: defaultValue,
        }

        beforeEach(() => {
          service = new FormService(
            MODEL,
            {
              type: { [clipKey]: true },
            },
            onChangeSpy,
          )
        })

        it('returns the proper schema', () =>
          expect(service[propKey]).to.be.eql(EXPECTED_RESULT))
      })

      context(`when clipping the ${key} schema (array)`, () => {
        const MODEL = {
          id: '123',
          name: 'Test',
          types: [{
            label: 'Default',
            value: null,
          }],
        }

        const EXPECTED_RESULT = {
          id: defaultValue,
          name: defaultValue,
          types: defaultValue,
        }

        beforeEach(() => {
          service = new FormService(
            MODEL,
            {
              types: { [clipKey]: true },
            },
            onChangeSpy,
          )
        })

        it('returns the proper schema', () =>
          expect(service[propKey]).to.be.eql(EXPECTED_RESULT))
      })

      context(`when clipping the ${key} schema (array-child)`, () => {
        const MODEL = {
          id: '123',
          name: 'Test',
          types: [{
            label: 'Default',
            value: null,
          }],
        }

        const EXPECTED_RESULT = {
          id: defaultValue,
          name: defaultValue,
          types: [defaultValue],
        }

        beforeEach(() => {
          service = new FormService(
            MODEL,
            {
              types: {
                genItem: () => ({ label: '', value: null }),
                children: { [clipKey]: true },
              },
            },
            onChangeSpy,
          )
        })

        it('returns the proper schema', () =>
          expect(service[propKey]).to.be.eql(EXPECTED_RESULT))

        context('when adding an item', () => {
          const RESULT_ADDED = {
            ...EXPECTED_RESULT,
            types: [defaultValue, defaultValue],
          }

          beforeEach(() => {
            service.addItem('types')
          })

          it('clips the schema on the new item', () =>
            expect(service[propKey]).to.be.eql(RESULT_ADDED))
        })
      })
    })
  })

  describe('when using nested formatters', () => {
    function genService (model) {
      return new FormService(model, {
        phones: {
          format: v => padArray(v),
          unformat: v => filterEmpty(v),
          children: {
            number: {
              format: v => toPhoneNumber(v),
              unformat: v => toNumeric(v),
            },
          },
        },
      }, onChangeSpy)
    }

    context('when removing array elements', () => {
      const MODEL = { phones: [{ number: '7025551234', type: '' }] }

      beforeEach(() => {
        service = genService(MODEL)
      })

      it('does not throw an error', () =>
        expect(service.buildModel()).to.not.throw)
    })

    context('when format() adds array elements', () => {
      const MODEL = { phones: [{ number: '7025551234', type: 'Home' }] }

      beforeEach(() => {
        service = genService(MODEL)
      })

      it('does not throw an error', () =>
        expect(service.buildModel()).to.not.throw)
    })
  })

  describe('validation', () => {
    let valid

    const NAME_MATCH = 'asdf'
    const VALIDATOR_NAME_MATCH = {
      error: 'Invalid',
      validate: v => v === NAME_MATCH,
    }

    context('when invalid data is provided (single validator)', () => {
      beforeEach(() => {
        service = new FormService(
          {
            name: '',
            description: '',
            amount: '',
          },
          { name: [required()] },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('fails', () => expect(valid).to.be.false)

      it('is flagged with errors', () => expect(service.hasErrors).to.be.true)

      it('removes pristine status from all fields', () =>
        expect(service.__pristine).to.be.eql({
          name: false,
          description: false,
          amount: false,
        }))

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        {
          name: '',
          description: '',
          amount: '',
        },
        {
          name: 'Required',
          description: '',
          amount: '',
        },
      ]))
    })

    context('when valid data is provided (single validator)', () => {
      beforeEach(() => {
        service = new FormService(
          { name: 'asdf' },
          { name: [required()] },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('passes', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { name: 'asdf' },
        { name: '' },
      ]))
    })

    context('when invalid data is provided (multiple validators)', () => {
      beforeEach(() => {
        service = new FormService(
          { name: 'Wronguy' },
          { name: [required(), VALIDATOR_NAME_MATCH] },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('fails', () => expect(valid).to.be.false)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { name: 'Wronguy' },
        { name: 'Invalid' },
      ]))

      context('when failing on the first validator', () => {
        beforeEach(() => {
          service.apply('name', '')
          valid = service.validate()
        })

        it('invokes callback with an error for the first failure', () =>
          expect(getLastChange()).to.be.eql([
            true,
            { name: '' },
            { name: 'Required' },
          ])
        )
      })
    })

    context('when invalid data is provided (multiple validators)', () => {
      beforeEach(() => {
        service = new FormService(
          { name: NAME_MATCH },
          { name: [required(), VALIDATOR_NAME_MATCH] },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('passes', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { name: NAME_MATCH },
        { name: '' },
      ]))
    })

    context('when validating across multiple levels of selectors', () => {
      beforeEach(() => {
        service = new FormService(
          { tax: { name: '', rate: '' } },
          {
            tax: {
              validators: [requiredIf('name', 'rate')],
              children: {
                rate: [range(0, 100, false, false, '0 - 100')],
              },
            },
          },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('passes', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { tax: { name: '', rate: '' } },
        { tax: { name: '', rate: '' } },
      ]))

      context('when setting a name', () => {
        beforeEach(() => {
          service.apply('tax.name', 'asdf')
          valid = service.validate()
        })

        it('fails', () => expect(valid).to.be.false)

        it('invokes callback', () => expect(getLastChange()).to.be.eql([
          true,
          { tax: { name: 'asdf', rate: '' } },
          { tax: { name: '', rate: 'Required' } },
        ]))

        context('when providing an INVALID rate', () => {
          beforeEach(() => {
            service.apply('tax.rate', '-10')
            valid = service.validate()
          })

          it('fails', () => expect(valid).to.be.false)

          it('invokes callback', () => expect(getLastChange()).to.be.eql([
            true,
            { tax: { name: 'asdf', rate: '-10' } },
            { tax: { name: '', rate: '0 - 100' } },
          ]))

          context('when providing a VALID rate', () => {
            beforeEach(() => {
              service.apply('tax.rate', '10')
              valid = service.validate()
            })

            it('passes', () => expect(valid).to.be.true)

            it('invokes callback', () => expect(getLastChange()).to.be.eql([
              true,
              { tax: { name: 'asdf', rate: '10' } },
              { tax: { name: '', rate: '' } },
            ]))
          })
        })

        context('when removing the name', () => {
          beforeEach(() => {
            service.apply('tax.name', '')
            valid = service.validate()
          })

          it('passes again', () => expect(valid).to.be.true)

          it('invokes callback', () => expect(getLastChange()).to.be.eql([
            false,
            { tax: { name: '', rate: '' } },
            { tax: { name: '', rate: '' } },
          ]))
        })
      })
    })

    context('when validating an array', () => {
      const SCHEMA_PHONES_EMPTY = new Array(2).fill({ number: '', type: '' })

      beforeEach(() => {
        service = new FormService(
          { phones: SCHEMA_PHONES_EMPTY },
          {
            phones: {
              genItem: () => ({ number: '', type: '' }),
              validators: [{
                error: { type: 'Required' },
                validate: v => !v.number || v.type,
              }],
              children: { number: [isPhoneNumber] },
            },
          },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('is valid', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { phones: SCHEMA_PHONES_EMPTY },
        { phones: SCHEMA_PHONES_EMPTY },
      ]))

      context('when errors are present', () => {
        beforeEach(() => {
          service.apply('phones.0.type', 'Home')
          service.apply('phones.1.number', '7025551234')

          valid = service.validate()
        })

        it('is NOT valid', () => expect(valid).to.be.false)

        it('has errors', () =>
          expect(service.__errors).to.be.eql({
            phones: [
              { type: '', number: '' },
              { type: 'Required', number: '' },
            ],
          }))
      })
    })

    context('when ignoring pristine status of a key', () => {
      beforeEach(() => {
        service = new FormService(
          { rate: '' },
          {
            rate: {
              ignorePristine: true,
              validators: [range(0, 100, false, false, '0 - 100')],
            },
          },
          onChangeSpy,
        )

        service.apply('rate', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).to.be.eql({ rate: '0 - 100' }))
    })

    context('when ignoring pristine status of a key (array)', () => {
      beforeEach(() => {
        service = new FormService(
          { rates: [''] },
          {
            rates: {
              genItem: () => '',
              validators: [range(0, 100, false, false, '0 - 100')],
              children: { ignorePristine: true },
            },
          },
          onChangeSpy,
        )

        service.apply('rates.0', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).to.be.eql({ rates: ['0 - 100'] }))

      context('when adding an item to the array', () => {
        beforeEach(() => {
          service.addItem('rates')
          service.apply('rates.1', 101)
        })

        it('immediately errors', () =>
          expect(service.__errors).to.be.eql({ rates: ['0 - 100', '0 - 100'] }))
      })
    })

    context('when ignoring pristine status of a key (array-child)', () => {
      beforeEach(() => {
        service = new FormService(
          { taxes: [{ name: '', rate: '' }] },
          {
            taxes: {
              genItem: () => ({ name: '', rate: '' }),
              children: {
                rate: {
                  ignorePristine: true,
                  validators: [range(0, 100, false, false, '0 - 100')],
                },
              },
            },
          },
          onChangeSpy,
        )

        service.apply('taxes.0.rate', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).to.be.eql({
          taxes: [{ name: '', rate: '0 - 100' }],
        }))

      context('when adding an item to the array', () => {
        beforeEach(() => {
          service.addItem('taxes')
          service.apply('taxes.1.rate', 101)
        })

        it('immediately errors', () =>
          expect(service.__errors).to.be.eql({
            taxes: [
              { name: '', rate: '0 - 100' },
              { name: '', rate: '0 - 100' },
            ],
          }))
      })
    })
  })
})
