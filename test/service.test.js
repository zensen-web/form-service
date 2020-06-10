import sinon from 'sinon'
import pkg from 'validator'

import {
  FormService,
  VerificationError,
  ValidationError,
  PristineError,
  MutationError,
} from '../src'

import {
  filterEmpty,
  padArray,
  map,
  getValueByPath,
} from '../src/utils'

import {
  required,
  requiredIf,
  range,
} from '../src/validators'

import {
  toNumeric,
  toCurrency,
  toPhoneNumber,
} from './formatters'

const DATE = new Date(2020, 0, 1, 0, 0, 0, 0)
const MODIFIERS = ['ab', 'cd', 'ef', 'gh']

const PERIOD = {
  AM: 'am',
  PM: 'pm',
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

const MODEL_COMPLEX = {
  name: 'Gremlin',
  level: 1,
  stats: {
    attack: 4,
    evasion: 3,
    speed: 2,
  },
  ailments: [3, 4, 7],
  items: [
    { id: 1, rate: 0.1 },
    { id: 3, rate: 0.4 },
  ],
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
  modifiers: '',
}

const passValidator = {
  error: '',
  validator: () => true,
}

const phoneNumberValidator = {
  error: 'Invalid phone number',
  validate: v => !v || pkg.isMobilePhone(v),
}

const segmentValidator = {
  error: 'Conflicting Time',
  validate: (v, keyPath, state) => {
    const key = keyPath[keyPath.length - 1]
    const otherKey = key === 'start' ? 'end' : 'start'
    const durationPath = keyPath.slice(0, keyPath.length - 1)
    const otherPath = [...durationPath, otherKey]
    const minutes = timeToScalar(v)
    const otherMinutes = timeToScalar(getValueByPath(state, otherPath))

    return key === 'start' ? (minutes < otherMinutes) : (minutes > otherMinutes)
  },
}

const intervalValidator = {
  error: 'Intersecting Interval',
  validate: (v, keyPath, state) => {
    const key = keyPath[keyPath.length - 1]
    const otherKey = key === 'start' ? 'end' : 'start'
    const segmentPath = keyPath.slice(0, keyPath.length - 1)
    const segmentIndex = Number(segmentPath[segmentPath.length - 1])
    const offset = key === 'start' ? -1 : 1
    const otherIndex = segmentIndex + offset
    const itemsPath = keyPath.slice(0, keyPath.length - 2)
    const items = getValueByPath(state, itemsPath)

    if (otherIndex < 0 || otherIndex > items.length - 1) {
      return true
    }

    const otherPath = [...itemsPath, `${otherIndex}`, otherKey]
    const minutes = timeToScalar(v)
    const otherMinutes = timeToScalar(getValueByPath(state, otherPath))

    return key === 'start' ? (minutes > otherMinutes) : (minutes < otherMinutes)
  },
}

function timeToScalar (time) {
  const periodToMinutes =
    time.period === PERIOD.PM && time.hours !== 12 ? 720 : 0

  return periodToMinutes + (time.hours * 60) + (time.minutes)
}

describe('FormService', () => {
  let sandbox
  let service
  let requiredValidator
  let onChangeSpy

  const getLastChange = () => onChangeSpy.lastCall.args

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    onChangeSpy = sandbox.spy()

    requiredValidator = { ...required() }
  })

  afterEach(() => {
    sandbox.restore()
  })

  context('when a complex set of selectors are provided', () => {
    const FORMATTERS = {
      format: v => v,
      unformat: v => v,
    }

    const SELECTORS = {
      name: FORMATTERS,
      stats: {
        ...FORMATTERS,
        children: {
          attack: FORMATTERS,
          evasion: FORMATTERS,
          speed: FORMATTERS,
        },
      },
      ailments: {
        ...FORMATTERS,
        children: FORMATTERS,
      },
      items: {
        ...FORMATTERS,
        children: {
          ...FORMATTERS,
          id: FORMATTERS,
          rate: FORMATTERS,
        },
      },
      triangles: {
        ...FORMATTERS,
        children: {
          ...FORMATTERS,
          children: {
            ...FORMATTERS,
          },
        },
      },
    }

    beforeEach(() => {
      service = new FormService(MODEL_COMPLEX, SELECTORS, onChangeSpy)
    })

    describe('getSelectorPath()', () => {
      it('finds the selector for "name"', () =>
        expect(service.getSelectorPath(['name'])).to.be.eql(['name']))

      it('does not find a selector for "level"', () =>
        expect(service.getSelectorPath(['level'])).to.be.eql(['level']))

      it('finds a selector for "stats"', () =>
        expect(service.getSelectorPath(['stats'])).to.be.eql(['stats']))

      it('finds a selector for "stats.attack"', () =>
        expect(service.getSelectorPath(['stats', 'attack'])).to.be.eql([
          'stats', 'children', 'attack',
        ]))

      it('finds a selector for "stats.evasion"', () =>
        expect(service.getSelectorPath(['stats', 'evasion'])).to.be.eql([
          'stats', 'children', 'evasion',
        ]))

      it('finds a selector for "stats.speed"', () =>
        expect(service.getSelectorPath(['stats', 'speed'])).to.be.eql([
          'stats', 'children', 'speed',
        ]))

      it('finds a selector for "stats.ailments"', () =>
        expect(service.getSelectorPath(['ailments'])).to.be.eql(['ailments']))

      it('finds a selector for "ailments.0"', () =>
        expect(service.getSelectorPath(['ailments', '0'])).to.be.eql([
          'ailments', 'children',
        ]))

      it('finds a selector for "items"', () =>
        expect(service.getSelectorPath(['items'])).to.be.eql(['items']))

      it('finds a selector for "items.0"', () =>
        expect(service.getSelectorPath(['items', '0'])).to.be.eql([
          'items', 'children',
        ]))

      it('finds a selector for "items.0.id"', () =>
        expect(service.getSelectorPath(['items', '0', 'id'])).to.be.eql([
          'items', 'children', 'id',
        ]))

      it('finds a selector for "items.0.rate"', () =>
        expect(service.getSelectorPath(['items', '0', 'rate'])).to.be.eql([
          'items', 'children', 'rate',
        ]))
    })

    describe('getSelector()', () => {
      it('finds the selector for "name"', () =>
        expect(service.getSelector(['name'])).to.be.eq(SELECTORS.name))

      it('does not find a selector for "level"', () =>
        expect(service.getSelector(['level'])).to.be.eq(undefined))

      it('finds a selector for "stats"', () =>
        expect(service.getSelector(['stats'])).to.be.eq(SELECTORS.stats))

      it('finds a selector for "stats.attack"', () =>
        expect(service.getSelector(['stats', 'attack'])).to.be.eq(
          SELECTORS.stats.children.attack,
        ))

      it('finds a selector for "stats.evasion"', () =>
        expect(service.getSelector(['stats', 'evasion'])).to.be.eq(
          SELECTORS.stats.children.evasion,
        ))

      it('finds a selector for "stats.speed"', () =>
        expect(service.getSelector(['stats', 'speed'])).to.be.eq(
          SELECTORS.stats.children.speed,
        ))

      it('finds a selector for "stats.ailments"', () =>
        expect(service.getSelector(['ailments'])).to.be.eq(SELECTORS.ailments))

      it('finds a selector for "ailments.0"', () =>
        expect(service.getSelector(['ailments', '0'])).to.be.eq(
          SELECTORS.ailments.children,
        ))

      it('finds a selector for "items"', () =>
        expect(service.getSelector(['items'])).to.be.eq(SELECTORS.items))

      it('finds a selector for "items.0"', () =>
        expect(service.getSelector(['items', '0'])).to.be.eq(
          SELECTORS.items.children,
        ))

      it('finds a selector for "items.0.id"', () =>
        expect(service.getSelector(['items', '0', 'id'])).to.be.eq(
          SELECTORS.items.children.id,
        ))

      it('finds a selector for "items.0.id"', () =>
        expect(service.getSelector(['items', '0', 'rate'])).to.be.eq(
          SELECTORS.items.children.rate,
        ))
    })
  })

  context('when converters are NOT provided', () => {
    const ERRORS = {
      name: '',
      level: '',
      stats: {
        attack: '',
        evasion: '',
        speed: '',
      },
      ailments: ['', '', ''],
      items: [
        { id: '', rate: '' },
        { id: '', rate: '' },
      ],
    }

    beforeEach(() => {
      service = new FormService(MODEL_COMPLEX, {}, onChangeSpy)
    })

    it('invokes onChange', () =>
      expect(getLastChange()).to.be.eql([false, MODEL_COMPLEX, ERRORS]))

    context('when modifying a key that does not exist', () => {  
      const NAME_INVALID = 'asdf'
      const fn = () => service.apply(NAME_INVALID)
  
      it('throw an error', () =>
        expect(fn).to.throw(TypeError, `Invalid path: ${NAME_INVALID}`))
    })

    context('when mutating an object to a primitive', () => {  
      const fn = () => service.apply('stats', '')
  
      it('throw an error', () => expect(fn).to.throw(MutationError))
    })

    context('when adding a rogue property to sub-object', () => {  
      const fn = () => service.apply('stats', {})
  
      it('throw an error', () => expect(fn).to.throw(MutationError))
    })

    context('when modifying a key that does not have pristine status', () => {  
      const fn = () => service.apply('stats', {
        attack: 'a',
        evasion: 'b',
        speed: 'c',
      })
  
      it('throw an error', () => expect(fn).to.throw(PristineError))
    })
  })

  context('when converters are provided', () => {
    beforeEach(() => {
      service = new FormService(
        MODEL,
        {
          procedure: [requiredValidator],
          modifiers: {
            genItem: () => '',
            validators: [
              {
                error: 'asdf',
                validate: () => false,
              },
            ],
          },
          amount: {
            format: v => toCurrency(v),
            unformat: v => toNumeric(v),
          },
        },
        onChangeSpy,
      )
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
        service.removeItem('modifiers')
      })

      it('removes it', () =>
        expect(service.__state.modifiers).to.be.eql(['ab', 'cd', 'ef']))
    })

    context('when removing an item from an array', () => {
      beforeEach(() => {
        service.removeItem('modifiers', 0)
      })

      it('removes it', () =>
        expect(service.__state.modifiers).to.be.eql(['cd', 'ef', 'gh']))
    })

    context('when moving an item in the array', () => {
      const EXPECTED_MODEL = ['ef', 'ab', 'cd', 'gh']
      const EXPECTED_PRISTINE = [false, true, true, true]
      const EXPECTED_ERRORS = 'asdf'

      beforeEach(() => {
        service.apply('modifiers.2', 'touched')
        service.apply('modifiers.2', 'ef')
        service.moveItem('modifiers', 2, 0)
      })

      it('reorders the item in the state', () =>
        expect(service.__state.modifiers).to.be.eql(EXPECTED_MODEL))

      it('reorders the item in the error schema', () =>
        expect(service.__errors.modifiers).to.be.eql(EXPECTED_ERRORS))

      it('reorders the item in the pristine schema', () =>
        expect(service.__pristine.modifiers).to.be.eql(EXPECTED_PRISTINE))
    })

    context('when swapping an item in the array', () => {
      const EXPECTED_MODEL = ['ef', 'cd', 'ab', 'gh']
      const EXPECTED_PRISTINE = [false, true, false, true]
      const EXPECTED_ERRORS = 'asdf'

      beforeEach(() => {
        service.apply('modifiers.2', 'touched')
        service.apply('modifiers.2', 'ef')
        service.swapItems('modifiers', 2, 0)
      })

      it('swaps the selected items in the state', () =>
        expect(service.__state.modifiers).to.be.eql(EXPECTED_MODEL))

      it('swaps the selected items in the error schema', () =>
        expect(service.__errors.modifiers).to.be.eql(EXPECTED_ERRORS))

      it('swaps the selected items in the pristine schema', () =>
        expect(service.__pristine.modifiers).to.be.eql(EXPECTED_PRISTINE))
    })
  })

  context('when converters are provided to array items', () => {
    const MODEL = {
      items: [1, 4.25, 14.75],
    }

    const MODEL_EXPECTED = {
      items: [
        { hours: 1, minutes: 0, period: PERIOD.AM },
        { hours: 4, minutes: 15, period: PERIOD.AM },
        { hours: 2, minutes: 45, period: PERIOD.PM },
      ],
    }

    const SELECTORS = {
      items: {
        genItem: () => 12,
        children: {
          format: v => ({
            hours: Math.floor(v > 12 ? v - 12 : v),
            minutes: (v - Math.floor(v)) * 60,
            period: v >= 12 ? PERIOD.PM : PERIOD.AM,
          }),
          unformat: v => {
            const model = map(v, (keyPath, value) =>
              (keyPath[0] !== 'period' ? Number(value) : value))

            const offset = model.period === 'PM' ? 12 : 0

            return model.hours + (model.minutes / 60) + offset
          },
        },
      },
    }

    beforeEach(() => {
      service = new FormService(MODEL, SELECTORS, onChangeSpy)
    })

    it('formats each item in the state', () =>
      expect(service.__state).to.be.eql(MODEL_EXPECTED))
  })

  describe('schema clipping', () => {
    context(`when clipping the pristine schema`, () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        type: {
          label: 'Default',
          value: null,
        },
      }

      const EXPECTED_RESULT = {
        id: true,
        name: true,
        type: true,
      }

      beforeEach(() => {
        service = new FormService(
          MODEL,
          {
            type: { clipPristine: true },
          },
          onChangeSpy,
        )
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).to.be.eql(EXPECTED_RESULT))
    })

    context(`when clipping the pristine schema (array)`, () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [{
          label: 'Default',
          value: null,
        }],
      }

      const EXPECTED_RESULT = {
        id: true,
        name: true,
        types: true,
      }

      beforeEach(() => {
        service = new FormService(
          MODEL,
          {
            types: { clipPristine: true },
          },
          onChangeSpy,
        )
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).to.be.eql(EXPECTED_RESULT))
    })

    context(`when clipping the pristine schema (array-child)`, () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [{
          label: 'Default',
          value: null,
        }],
      }

      const EXPECTED_RESULT = {
        id: true,
        name: true,
        types: [true],
      }

      beforeEach(() => {
        service = new FormService(
          MODEL,
          {
            types: {
              genItem: () => ({ label: '', value: null }),
              children: { clipPristine: true },
            },
          },
          onChangeSpy,
        )
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).to.be.eql(EXPECTED_RESULT))

      context('when adding an item', () => {
        const RESULT_ADDED = {
          ...EXPECTED_RESULT,
          types: [true, true],
        }

        beforeEach(() => {
          service.addItem('types')
        })

        it('clips the schema on the new item', () =>
          expect(service.__pristine).to.be.eql(RESULT_ADDED))
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

    context('when nested validators are found', () => {
      const MODEL = {
        stats: {
          a: '',
        },
      }

      const SELECTORS = {
        stats: {
          validators: [passValidator],
          children: {
            a: [passValidator],
          },
        },
      }

      const fn = () => new FormService(MODEL, SELECTORS, onChangeSpy)

      it('throw an error', () => expect(fn).to.throw(VerificationError))
    })

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
              children: {
                rate: [
                  requiredIf('name'),
                  range(0, 100, false, false, '0 - 100'),
                ],
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

    context('when errors are clipped', () => {
      beforeEach(() => {
        service = new FormService(
          {
            items: [
              {
                start: { hours: 8, minutes: 0, period: PERIOD.AM },
                end: { hours: 12, minutes: 0, period: PERIOD.PM },
              },
              {
                start: { hours: 13, minutes: 0, period: PERIOD.PM },
                end: { hours: 17, minutes: 0, period: PERIOD.PM },
              },
              {
                start: { hours: 16, minutes: 0, period: PERIOD.PM },
                end: { hours: 18, minutes: 0, period: PERIOD.PM },
              },
            ],
          },
          {
            items: {
              children: {
                start: {
                  clipErrors: true,
                  validators: [segmentValidator, intervalValidator],
                },
                end: {
                  clipErrors: true,
                  validators: [segmentValidator, intervalValidator],
                },
              },
            },
          },
          onChangeSpy,
        )

        valid = service.validate()
      })

      it('is invalid', () => expect(valid).to.be.false)

      context('when validating a second time', () => {
        beforeEach(() => {
          valid = service.validate()
        })

        it('is still invalid', () => expect(valid).to.be.false)
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
              children: {
                number: [phoneNumberValidator],
                type: [requiredIf('number')],
              },
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
              children: {
                ignorePristine: true,
                validators: [range(0, 100, false, false, '0 - 100')],
              },
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
