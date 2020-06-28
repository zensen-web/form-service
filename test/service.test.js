import sinon from 'sinon'

import {
  VerificationError,
  PristineError,
  MutationError,
  PathError,
  FormService,
} from '../src'

import {
  filterEmpty,
  padArray,
} from '../src/utils'

import {
  required,
  requiredIf,
  range,
} from '../src/validators'

import {
  PERIOD,
  MODIFIERS,
  CHARGE_MODEL,
  CHARGE_STATE,
  CHARGE_ERRORS,
  ENEMY_MODEL,
  ENEMY_SELECTORS,
  ENEMY_ERRORS,
  toNumeric,
  toCurrency,
  toPhoneNumber,
  hoursToObj,
  objToHours,
  passValidator,
  phoneNumberValidator,
  segmentValidator,
  intervalValidator,
} from './helpers'

describe.only('FormService', () => {
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

  describe('verifying selectors', () => {
    const MODEL = {
      stats: {
        a: '',
      },
    }

    context('when nested validators are found', () => {
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

    context('when setting ignorePristine on object-type key', () => {
      const SELECTORS = {
        stats: {
          ignorePristine: true,
        },
      }

      const fn = () => new FormService(MODEL, SELECTORS, onChangeSpy)

      it('throw an error', () => expect(fn).to.throw(VerificationError))
    })
  })

  describe('getSelectorPath()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, ENEMY_SELECTORS, onChangeSpy)
    })

    it('throws an error when an invalid path is provided: "asdf"', () =>
      expect(() => service.getSelectorPath(['asdf'])).to.throw(PathError))

    it('resolve the path for "name"', () =>
      expect(service.getSelectorPath(['name'])).to.be.eql(['name']))

    it('resolve the path for "job"', () =>
      expect(service.getSelectorPath(['job'])).to.be.eql(['job']))

    it('resolve the path for "stats"', () =>
      expect(service.getSelectorPath(['stats'])).to.be.eql(['stats']))

    it('resolve the path for "stats.attack"', () =>
      expect(service.getSelectorPath(['stats', 'attack'])).to.be.eql([
        'stats', 'children', 'attack',
      ]))

    it('resolve the path for "stats.evasion"', () =>
      expect(service.getSelectorPath(['stats', 'evasion'])).to.be.eql([
        'stats', 'children', 'evasion',
      ]))

    it('resolve the path for "stats.speed"', () =>
      expect(service.getSelectorPath(['stats', 'speed'])).to.be.eql([
        'stats', 'children', 'speed',
      ]))

    it('resolve the path for "stats.attributes"', () =>
      expect(service.getSelectorPath(['stats', 'attributes'])).to.be.eql([
        'stats', 'children', 'attributes',
      ]))

    it('resolve the path for "stats.attributes.level"', () =>
      expect(service.getSelectorPath(['stats', 'attributes', 'level'])).to.be.eql([
        'stats', 'children', 'attributes', 'children', 'level',
      ]))

    it('resolve the path for "stats.attributes.experience"', () =>
      expect(service.getSelectorPath(['stats', 'attributes', 'experience'])).to.be.eql([
        'stats', 'children', 'attributes', 'children', 'experience',
      ]))

    it('resolve the path for "stats.ailments"', () =>
      expect(service.getSelectorPath(['ailments'])).to.be.eql(['ailments']))

    it('resolve the path for "ailments.0"', () =>
      expect(service.getSelectorPath(['ailments', '0'])).to.be.eql([
        'ailments', 'children', '$',
      ]))

    it('resolve the path for "items"', () =>
      expect(service.getSelectorPath(['items'])).to.be.eql(['items']))

    it('resolve the path for "items.0"', () =>
      expect(service.getSelectorPath(['items', '0'])).to.be.eql([
        'items', 'children', '$',
      ]))

    it('resolve the path for "items.0.id"', () =>
      expect(service.getSelectorPath(['items', '0', 'id'])).to.be.eql([
        'items', 'children', '$', 'children', 'id',
      ]))

    it('resolve the path for "items.0.rate"', () =>
      expect(service.getSelectorPath(['items', '0', 'rate'])).to.be.eql([
        'items', 'children', '$', 'children', 'rate',
      ]))

    it('resolve the path for "triangles"', () =>
      expect(service.getSelectorPath(['triangles'])).to.be.eql(['triangles']))

    it('resolve the path for "triangles.0"', () =>
      expect(service.getSelectorPath(['triangles', '0'])).to.be.eql([
        'triangles', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.0"', () =>
      expect(service.getSelectorPath(['triangles', '0', '0'])).to.be.eql([
        'triangles', 'children', '$', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.1"', () =>
      expect(service.getSelectorPath(['triangles', '0', '1'])).to.be.eql([
        'triangles', 'children', '$', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.2"', () =>
      expect(service.getSelectorPath(['triangles', '0', '2'])).to.be.eql([
        'triangles', 'children', '$', 'children', '$',
      ]))

    it('throws an error when an invalid path is provided: "triangles.0.3"', () =>
      expect(() => service.getSelectorPath(['triangles.0.3'])).to.throw(PathError))
  })

  describe('getSelector()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, ENEMY_SELECTORS, onChangeSpy)
    })

    it('throws an error when an invalid path is provided: "asdf"', () =>
      expect(() => service.getSelector(['asdf'])).to.throw(PathError))

    it('finds the selector for "name"', () =>
      expect(service.getSelector(['name'])).to.be.eq(ENEMY_SELECTORS.name))

    it('does not find a selector for "job"', () =>
      expect(service.getSelector(['job'])).to.be.eq(undefined))

    it('finds a selector for "stats"', () =>
      expect(service.getSelector(['stats'])).to.be.eq(ENEMY_SELECTORS.stats))

    it('finds a selector for "stats.attack"', () =>
      expect(service.getSelector(['stats', 'attack'])).to.be.eq(
        ENEMY_SELECTORS.stats.children.attack,
      ))

    it('finds a selector for "stats.evasion"', () =>
      expect(service.getSelector(['stats', 'evasion'])).to.be.eq(
        ENEMY_SELECTORS.stats.children.evasion,
      ))

    it('finds a selector for "stats.speed"', () =>
      expect(service.getSelector(['stats', 'speed'])).to.be.eq(
        ENEMY_SELECTORS.stats.children.speed,
      ))

    it('finds a selector for "stats.attributes"', () =>
      expect(service.getSelector(['stats', 'attributes'])).to.be.eq(
        ENEMY_SELECTORS.stats.children.attributes,
      ))

    it('finds a selector for "stats.attributes.level"', () =>
      expect(service.getSelector(['stats', 'attributes', 'level'])).to.be.eq(
        ENEMY_SELECTORS.stats.children.attributes.children.level,
      ))

    it('finds a selector for "stats.attributes.experience"', () =>
      expect(service.getSelector(['stats', 'attributes', 'experience'])).to.be.eq(
        ENEMY_SELECTORS.stats.children.attributes.children.experience,
      ))

    it('finds a selector for "stats.ailments"', () =>
      expect(service.getSelector(['ailments'])).to.be.eq(ENEMY_SELECTORS.ailments))

    it('finds a selector for "ailments.0"', () =>
      expect(service.getSelector(['ailments', '0'])).to.be.eq(
        ENEMY_SELECTORS.ailments.children.$,
      ))

    it('finds a selector for "items"', () =>
      expect(service.getSelector(['items'])).to.be.eq(ENEMY_SELECTORS.items))

    it('finds a selector for "items.0"', () =>
      expect(service.getSelector(['items', '0'])).to.be.eq(
        ENEMY_SELECTORS.items.children.$,
      ))

    it('finds a selector for "items.0.id"', () =>
      expect(service.getSelector(['items', '0', 'id'])).to.be.eq(
        ENEMY_SELECTORS.items.children.$.children.id,
      ))

    it('finds a selector for "items.0.rate"', () =>
      expect(service.getSelector(['items', '0', 'rate'])).to.be.eq(
        ENEMY_SELECTORS.items.children.$.children.rate,
      ))

    it('finds a selector for "triangles"', () =>
      expect(service.getSelector(['triangles'])).to.be.eq(
        ENEMY_SELECTORS.triangles,
      ))

    it('finds a selector for "triangles.0"', () =>
      expect(service.getSelector(['triangles', '0'])).to.be.eq(
        ENEMY_SELECTORS.triangles.children.$,
      ))

    it('finds a selector for "triangles.0.0"', () =>
      expect(service.getSelector(['triangles', '0', '0'])).to.be.eq(
        ENEMY_SELECTORS.triangles.children.$.children.$,
      ))

    it('finds a selector for "triangles.0.1"', () =>
      expect(service.getSelector(['triangles', '0', '1'])).to.be.eq(
        ENEMY_SELECTORS.triangles.children.$.children.$,
      ))

    it('finds a selector for "triangles.0.2"', () =>
      expect(service.getSelector(['triangles', '0', '2'])).to.be.eq(
        ENEMY_SELECTORS.triangles.children.$.children.$,
      ))


    it('throws an error when an invalid path is provided: "triangles.0.3"', () =>
      expect(() => service.getSelector(['triangles', '0', '3'])).to.throw(PathError))
  })

  describe('apply()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeSpy)
    })

    it('invokes onChange', () =>
      expect(getLastChange()).to.be.eql([false, ENEMY_MODEL, ENEMY_ERRORS]))

    context('when modifying a top-level property', () => {
      const EXPECTED_STATE = {
        ...ENEMY_MODEL,
        name: 'Goblin',
      }

      beforeEach(() => {
        service.apply('name', 'Goblin')
      })

      it('invokes onChange', () => expect(getLastChange()).to.be.eql([
        true, EXPECTED_STATE, ENEMY_ERRORS,
      ]))
    })

    context('when modifying a sub-object property', () => {
      const EXPECTED_STATE = {
        ...ENEMY_MODEL,
        stats: {
          ...ENEMY_MODEL.stats,
          attack: 255,
        },
      }

      beforeEach(() => {
        service.apply('stats.attack', 255)
      })

      it('invokes onChange', () => expect(getLastChange()).to.be.eql([
        true, EXPECTED_STATE, ENEMY_ERRORS,
      ]))
    })

    context('when modifying a value to null', () => {
      const MODEL = {
        date: null,
      }

      const fn = () => service.apply('date', null)

      beforeEach(() => {
        service = new FormService(MODEL, {}, onChangeSpy)
      })

      it('throw an error', () => expect(fn).to.not.throw())
    })

    context('when modifying an object to null', () => {
      const SELECTORS = {
        stats: {
          clipPristine: true,
        },
      }

      const EXPECTED_STATE = {
        ...ENEMY_MODEL,
        stats: null,
      }

      beforeEach(() => {
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)
        service.apply('stats', null)
      })

      it('invokes onChange', () => expect(getLastChange()).to.be.eql([
        true, EXPECTED_STATE, ENEMY_ERRORS,
      ]))

      context('when modifying a null value to object', () => {  
        beforeEach(() => {
          service.apply('stats', ENEMY_MODEL.stats)
        })
  
        it('invokes onChange', () => expect(getLastChange()).to.be.eql([
          false, ENEMY_MODEL, ENEMY_ERRORS,
        ]))
      })
    })

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
      const fn = () => service.apply('stats.asdf', 42)
  
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

  describe('addItem()', () => {
    const MODEL = {
      items: [],
    }

    context('when adding a primitive item', () => {
      const SELECTORS = {
        items: {
          genItem: () => '',
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).to.be.eql({ items: [''] }))
    })

    context('when adding an object', () => {
      const SELECTORS = {
        items: {
          genItem: () => ({ id: '' }),
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).to.be.eql({ items: [{ id: '' }] }))
    })

    context('when adding an object and clipping errors for the array', () => {
      const SELECTORS = {
        items: {
          genItem: () => ({ id: '' }),
          validators: [],
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).to.be.eql({ items: '' }))
    })

    context('when adding an object and clipping errors for the array element', () => {
      const SELECTORS = {
        items: { 
          genItem: () => ({ id: '' }),
          children: {
            $: {
              validators: [],
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('invokes the callback', () =>
        expect(service.__errors).to.be.eql({ items: [''] }))
    })

    // FAILS due to schema clipping not working on shorthand validators
    context.skip('when adding an object item', () => {
      beforeEach(() => {
        service = new FormService(
          {
            items: [
              {
                start: { hours: 8, minutes: 0, period: PERIOD.AM },
                end: { hours: 12, minutes: 0, period: PERIOD.PM },
              },
            ],
          },
          {
            items: {
              genItem: () => ({
                start: { hours: 7, minutes: 0, period: PERIOD.AM },
                end: { hours: 17, minutes: 0, period: PERIOD.PM },
              }),
              children: {
                $: {
                  children: {
                    start: [segmentValidator, intervalValidator],
                    end: [segmentValidator, intervalValidator],
                  },
                },
              },
            },
          },
          onChangeSpy,
        )

        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).to.eql({
          items: [
            { start: '', end: '' },
            { start: '', end: '' },
          ],
        }))
    })
  })

  context('when converters are provided', () => {
    beforeEach(() => {
      service = new FormService(
        CHARGE_MODEL,
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
      expect(service.__state).to.be.eql(CHARGE_STATE))

    context('when a change occurs', () => {
      const EXPECTED_MODEL = { ...CHARGE_MODEL, procedure: '' }
      const EXPECTED_STATE = { ...CHARGE_STATE, procedure: '' }
      const EXPECTED_ERRORS = { ...CHARGE_ERRORS, procedure: 'Required' }

      beforeEach(() => {
        service.apply('procedure', '')
      })

      it('invokes onChange', () =>
        expect(getLastChange()).to.be.eql([
          false,
          EXPECTED_STATE,
          CHARGE_ERRORS,
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
            expect(service.__state).to.be.eql(CHARGE_STATE))

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
      const EXPECTED_STATE = ['ef', 'ab', 'cd', 'gh']
      const EXPECTED_PRISTINE = [false, true, true, true]
      const EXPECTED_ERRORS = 'asdf'

      beforeEach(() => {
        service.apply('modifiers.2', 'touched')
        service.apply('modifiers.2', 'ef')
        service.moveItem('modifiers', 2, 0)
      })

      it('reorders the item in the state', () =>
        expect(service.__state.modifiers).to.be.eql(EXPECTED_STATE))

      it('reorders the item in the error schema', () =>
        expect(service.__errors.modifiers).to.be.eql(EXPECTED_ERRORS))

      it('reorders the item in the pristine schema', () =>
        expect(service.__pristine.modifiers).to.be.eql(EXPECTED_PRISTINE))
    })

    context('when swapping an item in the array', () => {
      const EXPECTED_STATE = ['ef', 'cd', 'ab', 'gh']
      const EXPECTED_PRISTINE = [false, true, false, true]
      const EXPECTED_ERRORS = 'asdf'

      beforeEach(() => {
        service.apply('modifiers.2', 'touched')
        service.apply('modifiers.2', 'ef')
        service.swapItems('modifiers', 2, 0)
      })

      it('swaps the selected items in the state', () =>
        expect(service.__state.modifiers).to.be.eql(EXPECTED_STATE))

      it('swaps the selected items in the error schema', () =>
        expect(service.__errors.modifiers).to.be.eql(EXPECTED_ERRORS))

      it('swaps the selected items in the pristine schema', () =>
        expect(service.__pristine.modifiers).to.be.eql(EXPECTED_PRISTINE))
    })
  })

  context('when converters are provided to array items', () => {
    const validator = {
      error: 'Invalid',
      validate: () => true,
    }

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

    const ITEM_ADDED_HOURS = 16.75
    const ITEM_ADDED_OBJ = { hours: 4, minutes: 45, period: PERIOD.PM }

    const SELECTORS = {
      items: {
        genItem: () => ITEM_ADDED_HOURS,
        children: {
          $: {
            validators: [],
            format: v => hoursToObj(v),
            unformat: v => objToHours(v),
          },
        },
      },
    }

    beforeEach(() => {
      service = new FormService(MODEL, SELECTORS, onChangeSpy)
    })

    it('invokes callback', () => expect(getLastChange()).to.be.eql([
      false,
      MODEL_EXPECTED,
      {
        items: ['', '', ''],
      },
    ]))

    context('when adding an item', () => {
      beforeEach(() => {
        service.addItem('items')
      })

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        true,
        {
          items: [...MODEL_EXPECTED.items, ITEM_ADDED_OBJ]
        },
        {
          items: ['', '', '', ''],
        },
      ]))
    })
  })

  describe('clipPristine', () => {
    context(`when clipping an object`, () => {
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

    context(`when clipping an array`, () => {
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

    context(`when clipping an array's object-elements`, () => {
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
              children: {
                $: {
                  clipPristine: true,
                },
              },
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
    const SELECTORS = {
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
    }

    context('when removing array elements', () => {
      const MODEL = { phones: [{ number: '7025551234', type: '' }] }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('does not throw an error', () =>
        expect(service.buildModel()).to.not.throw)
    })

    context('when format() adds array elements', () => {
      const MODEL = { phones: [{ number: '7025551234', type: 'Home' }] }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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

    context.skip('when errors are clipped', () => {
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
              genItem: () => ({
                start: { hours: 7, minutes: 0, period: PERIOD.AM },
                end: { hours: 17, minutes: 0, period: PERIOD.PM },
              }),
              children: {
                $: {
                  children: {
                    start: [segmentValidator, intervalValidator],
                    end: [segmentValidator, intervalValidator],
                  },
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
                $: {
                  children: {
                    number: [phoneNumberValidator],
                    type: [requiredIf('number')],
                  },
                },
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
                $: {
                  ignorePristine: true,
                  validators: [range(0, 100, false, false, '0 - 100')],
                },
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
                $: {
                  children: {
                    rate: {
                      ignorePristine: true,
                      validators: [range(0, 100, false, false, '0 - 100')],
                    },
                  },
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
