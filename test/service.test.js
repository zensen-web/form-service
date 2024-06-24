import sinon from 'sinon'
import moment from 'moment-timezone'
import FormService from '../src/service'

import {
  VerificationError,
  PristineError,
  MutationError,
  PathError,
} from '../src/error'

import {
  filterEmpty,
  padArray,
  map,
  getValueByPath,
} from '../src/utils'

import {
  PERIOD,
  ENEMY_MODEL,
  ENEMY_ERRORS,
  ENEMY_PRISTINE,
  ENEMY_SELECTORS,
  ITEMS_MODEL,
  ITEMS_SELECTORS,
  toNumeric,
  toCurrency,
  toPhoneNumber,
  hoursToObj,
  objToHours,
  passValidator,
  failValidator,
  segmentValidator,
  intervalValidator,
  isRequired,
  isRequiredIf,
  isPhoneNumber,
  inRange,
} from './helpers'

describe('FormService', () => {
  let sandbox
  let service
  let model
  let onChangeSpy

  const getLastChange = () => onChangeSpy.lastCall.args

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    onChangeSpy = sandbox.spy()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('verify', () => {
    const MODEL = {
      stats: {
        a: '',
      },
    }

    context('when nested validators are found', () => {
      const SELECTORS = {
        children: {
          stats: {
            validators: [passValidator],
            children: {
              a: [passValidator],
            },
          },
        },
      }

      const fn = () => new FormService(MODEL, SELECTORS, onChangeSpy)

      it('throws an error', () => expect(fn).to.throw(VerificationError))
    })

    context('when setting ignorePristine on object-type key', () => {
      const SELECTORS = {
        children: {
          stats: {
            ignorePristine: true,
          },
        },
      }

      const fn = () => new FormService(MODEL, SELECTORS, onChangeSpy)

      it('throws an error', () => expect(fn).to.throw(VerificationError))
    })
  })

  describe('formatters', () => {
    const TIME_NUM = 4.25
    const TIME_OBJ = {
      hours: 4,
      minutes: 15,
      period: PERIOD.AM,
    }

    let selectors

    context('when format() is provided on selector', () => {
      const MODEL = { amount: 42 }
      const SELECTORS = {
        children: {
          amount: {
            format: v => toCurrency(v / 100),
            unformat: v => Number(toNumeric(v, true)) * 100,
          },
        },
      }

      let formatSpy
      let unformatSpy

      beforeEach(() => {
        formatSpy = sandbox.spy(SELECTORS.children.amount, 'format')
        unformatSpy = sandbox.spy(SELECTORS.children.amount, 'unformat')

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('invokes the format() modifier', () =>
        expect(formatSpy).to.be.calledOnceWith(42, ['amount'], MODEL))

      context('when unformat() is provided on a selector', () => {
        const STATE = {
          amount: '$0.42',
        }

        beforeEach(() => {
          model = service.build()
        })

        it('invokes the unformat() modifier', () =>
          expect(unformatSpy).to.be.calledOnceWith('$0.42', ['amount'], STATE))
      })
    })

    context('when formatting from primitive to object', () => {
      const MODEL = { time: TIME_NUM }
      const SELECTORS = {
        children: {
          time: {
            format: v => hoursToObj(v),
            unformat: v => objToHours(v),
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        model = service.build()
      })

      it('formats the field', () =>
        expect(service.__state.time).to.be.eql(TIME_OBJ))

      it('unformats the field', () =>
        expect(model.time).to.be.eq(TIME_NUM))
    })

    context('when formatting from object to primitive', () => {
      const MODEL = { time: TIME_OBJ }
      const SELECTORS = {
        children: {
          time: {
            format: v => objToHours(v),
            unformat: v => hoursToObj(v),
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        model = service.build()
      })

      it('formats the field', () =>
        expect(service.__state.time).to.be.eq(TIME_NUM))

      it('unformats the field', () =>
        expect(model.time).to.be.eql(TIME_OBJ))
    })

    context('when converters are provided to array items', () => {
      const MODEL = {
        items: [1, 4.25, 14.75],
      }

      const STATE = {
        items: [
          { hours: 1, minutes: 0, period: PERIOD.AM },
          { hours: 4, minutes: 15, period: PERIOD.AM },
          { hours: 2, minutes: 45, period: PERIOD.PM },
        ],
      }

      const SELECTORS = {
        children: {
          items: {
            createItem: () => ITEM_ADDED_HOURS,
            children: {
              $: {
                // validators: [],
                format: v => hoursToObj(v),
                unformat: v => objToHours(v),
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        model = service.build()
      })

      it('formats the state', () =>
        expect(service.__state).to.be.eql(STATE))

      it('unformats the state', () =>
        expect(model).to.be.eql(MODEL))
    })

    context('when providing nested formatters', () => {
      const MODEL = {
        phones: [{
          number: '7025551234',
          type: 'Home',
        }],
      }

      const STATE = {
        phones: [{
          number: '(702) 555-1234',
          type: 'Home',
        }],
      }

      const SELECTORS = {
        children: {
          phones: {
            format: v => padArray(v),
            unformat: v => filterEmpty(v),
            children: {
              $: {
                children: {
                  number: {
                    format: v => toPhoneNumber(v),
                    unformat: v => toNumeric(v),
                  },
                },
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        model = service.build()
      })

      it('formats the state', () =>
        expect(service.__state).to.be.eql(STATE))

      it('unformats the state', () =>
        expect(model).to.be.eql(MODEL))
    })

    context('when formatting the root (object)', () => {
      const MODEL = { amount: 42 }
      const SELECTORS = {
        format: v => ({ amount: toCurrency(v.amount / 100) }),
        unformat: v => ({ amount: Number(toNumeric(v.amount, true)) * 100 }),
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        model = service.build()
      })

      it('formats the field', () =>
        expect(service.__state).to.be.eql({ amount: '$0.42' }))

      it('unformats the field', () =>
        expect(model).to.be.eql({ amount: 42 }))
    })

    context('when formatting a custom object type', () => {
      const MODEL = { moment: moment('2012-03-05T05:00') }
      const SELECTORS = {
        children: {
          moment: {
            format: v => v.startOf('day'),
            unformat: v => v.endOf('day'),
          },
        },
      }

      let formatSpy
      let unformatSpy

      beforeEach(() => {
        formatSpy = sandbox.spy(SELECTORS.children.moment, 'format')
        unformatSpy = sandbox.spy(SELECTORS.children.moment, 'unformat')

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('invokes the format() modifier', () =>
        expect(formatSpy).to.be.calledOnce)

      it('uses cloned moment', () =>
        expect(formatSpy.getCall(0).args[0].isSame(MODEL.moment)).to.be.true)

      it('uses correct field', () =>
        expect(formatSpy.getCall(0).args[1])
          .to.eql(['moment']))

      it('uses correct data', () =>
        expect(formatSpy.getCall(0).args[2])
          .to.eql(MODEL))

      context('when unformat() is provided on a selector', () => {
        beforeEach(() => {
          model = service.build()
        })

        it('invokes the unformat() modifier', () =>
          expect(unformatSpy).to.be.calledOnce)
        it('invokes the unformat() modifier with correct date', () =>
          expect(unformatSpy.getCall(0).args[0].isSame(MODEL.moment.startOf('day'))).to.be.true)
      })
    })
  })

  // TODO: add formatters, and verify pristine
  describe('clipPristine', () => {
    context('when clipping an object', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        type: {
          label: 'Default',
          value: null,
        },
      }

      const SELECTORS = {
        children: {
          type: { clipPristine: true },
        },
      }

      const EXPECTED_RESULT = {
        id: true,
        name: true,
        type: true,
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).to.be.eql(EXPECTED_RESULT))
    })

    context('when clipping an array', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [{
          label: 'Default',
          value: null,
        }],
      }

      const SELECTORS = {
        children: {
          types: { clipPristine: true },
        },
      }

      const EXPECTED_RESULT = {
        id: true,
        name: true,
        types: true,
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).to.be.eql(EXPECTED_RESULT))
    })

    context('when clipping an array\'s object-elements', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [{
          label: 'Default',
          value: null,
        }],
      }

      const SELECTORS = {
        children: {
          types: {
            createItem: () => ({ label: '', value: null }),
            children: {
              $: {
                clipPristine: true,
              },
            },
          },
        },
      }

      const EXPECTED_RESULT = {
        id: true,
        name: true,
        types: [true],
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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

  describe('getSelectorPath()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, ENEMY_SELECTORS, onChangeSpy)
    })

    it('throws an error when an invalid path is provided: "asdf"', () =>
      expect(() => service.getSelectorPath(['asdf'])).to.throw(PathError))

    it('resovle the path for root', () =>
      expect(service.getSelectorPath([])).to.be.eql([]))

    it('resolve the path for "name"', () =>
      expect(service.getSelectorPath(['name'])).to.be.eql(['children', 'name']))

    it('resolve the path for "job"', () =>
      expect(service.getSelectorPath(['job'])).to.be.eql(['children', 'job']))

    it('resolve the path for "stats"', () =>
      expect(service.getSelectorPath(['stats'])).to.be.eql(['children', 'stats']))

    it('resolve the path for "stats.attack"', () =>
      expect(service.getSelectorPath(['stats', 'attack'])).to.be.eql([
        'children', 'stats', 'children', 'attack',
      ]))

    it('resolve the path for "stats.evasion"', () =>
      expect(service.getSelectorPath(['stats', 'evasion'])).to.be.eql([
        'children', 'stats', 'children', 'evasion',
      ]))

    it('resolve the path for "stats.speed"', () =>
      expect(service.getSelectorPath(['stats', 'speed'])).to.be.eql([
        'children', 'stats', 'children', 'speed',
      ]))

    it('resolve the path for "stats.attributes"', () =>
      expect(service.getSelectorPath(['stats', 'attributes'])).to.be.eql([
        'children', 'stats', 'children', 'attributes',
      ]))

    it('resolve the path for "stats.attributes.level"', () =>
      expect(service.getSelectorPath(['stats', 'attributes', 'level'])).to.be.eql([
        'children', 'stats', 'children', 'attributes', 'children', 'level',
      ]))

    it('resolve the path for "stats.attributes.experience"', () =>
      expect(service.getSelectorPath(['stats', 'attributes', 'experience'])).to.be.eql([
        'children', 'stats', 'children', 'attributes', 'children', 'experience',
      ]))

    it('resolve the path for "stats.ailments"', () =>
      expect(service.getSelectorPath(['ailments'])).to.be.eql(['children', 'ailments']))

    it('resolve the path for "ailments.0"', () =>
      expect(service.getSelectorPath(['ailments', '0'])).to.be.eql([
        'children', 'ailments', 'children', '$',
      ]))

    it('resolve the path for "items"', () =>
      expect(service.getSelectorPath(['items'])).to.be.eql(['children', 'items']))

    it('resolve the path for "items.0"', () =>
      expect(service.getSelectorPath(['items', '0'])).to.be.eql([
        'children', 'items', 'children', '$',
      ]))

    it('resolve the path for "items.0.id"', () =>
      expect(service.getSelectorPath(['items', '0', 'id'])).to.be.eql([
        'children', 'items', 'children', '$', 'children', 'id',
      ]))

    it('resolve the path for "items.0.rate"', () =>
      expect(service.getSelectorPath(['items', '0', 'rate'])).to.be.eql([
        'children', 'items', 'children', '$', 'children', 'rate',
      ]))

    it('resolve the path for "triangles"', () =>
      expect(service.getSelectorPath(['triangles'])).to.be.eql(['children', 'triangles']))

    it('resolve the path for "triangles.0"', () =>
      expect(service.getSelectorPath(['triangles', '0'])).to.be.eql([
        'children', 'triangles', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.0"', () =>
      expect(service.getSelectorPath(['triangles', '0', '0'])).to.be.eql([
        'children', 'triangles', 'children', '$', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.1"', () =>
      expect(service.getSelectorPath(['triangles', '0', '1'])).to.be.eql([
        'children', 'triangles', 'children', '$', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.2"', () =>
      expect(service.getSelectorPath(['triangles', '0', '2'])).to.be.eql([
        'children', 'triangles', 'children', '$', 'children', '$',
      ]))

    it('throws an error when an invalid path is provided: "triangles.0.3"', () =>
      expect(() => service.getSelectorPath(['triangles.0.3'])).to.throw(PathError))

    describe('array model', () => {
      beforeEach(() => {
        service = new FormService(ITEMS_MODEL, ITEMS_SELECTORS, onChangeSpy)
      })

      it('resolve the path for root', () =>
        expect(service.getSelectorPath([])).to.be.eql([]))

      it('resolve the path for "0"', () =>
        expect(service.getSelectorPath(['0'])).to.be.eql(['children', '$']))

      it('resolve the path for "0.id"', () =>
        expect(service.getSelectorPath(['0', 'id'])).to.be.eql([
          'children', '$', 'children', 'id',
        ]))

      it('resolve the path for "0.name"', () =>
        expect(service.getSelectorPath(['0', 'name'])).to.be.eql([
          'children', '$', 'children', 'name',
        ]))
    })
  })

  describe('getSelector()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, ENEMY_SELECTORS, onChangeSpy)
    })

    it('throws an error when an invalid path is provided: "asdf"', () =>
      expect(() => service.getSelector(['asdf'])).to.throw(PathError))

    it('finds the selector for root', () =>
      expect(service.getSelector([])).to.be.eq(ENEMY_SELECTORS))

    it('finds the selector for "name"', () =>
      expect(service.getSelector(['name'])).to.be.eq(
        ENEMY_SELECTORS.children.name,
      ))

    it('does not find a selector for "job"', () =>
      expect(service.getSelector(['job'])).to.be.eq(undefined))

    it('finds a selector for "stats"', () =>
      expect(service.getSelector(['stats'])).to.be.eq(
        ENEMY_SELECTORS.children.stats,
      ))

    it('finds a selector for "stats.attack"', () =>
      expect(service.getSelector(['stats', 'attack'])).to.be.eq(
        ENEMY_SELECTORS.children.stats.children.attack,
      ))

    it('finds a selector for "stats.evasion"', () =>
      expect(service.getSelector(['stats', 'evasion'])).to.be.eq(
        ENEMY_SELECTORS.children.stats.children.evasion,
      ))

    it('finds a selector for "stats.speed"', () =>
      expect(service.getSelector(['stats', 'speed'])).to.be.eq(
        ENEMY_SELECTORS.children.stats.children.speed,
      ))

    it('finds a selector for "stats.attributes"', () =>
      expect(service.getSelector(['stats', 'attributes'])).to.be.eq(
        ENEMY_SELECTORS.children.stats.children.attributes,
      ))

    it('finds a selector for "stats.attributes.level"', () =>
      expect(service.getSelector(['stats', 'attributes', 'level'])).to.be.eq(
        ENEMY_SELECTORS.children.stats.children.attributes.children.level,
      ))

    it('finds a selector for "stats.attributes.experience"', () =>
      expect(service.getSelector(['stats', 'attributes', 'experience'])).to.be.eq(
        ENEMY_SELECTORS.children.stats.children.attributes.children.experience,
      ))

    it('finds a selector for "stats.ailments"', () =>
      expect(service.getSelector(['ailments'])).to.be.eq(
        ENEMY_SELECTORS.children.ailments,
      ))

    it('finds a selector for "ailments.0"', () =>
      expect(service.getSelector(['ailments', '0'])).to.be.eq(
        ENEMY_SELECTORS.children.ailments.children.$,
      ))

    it('finds a selector for "items"', () =>
      expect(service.getSelector(['items'])).to.be.eq(
        ENEMY_SELECTORS.children.items,
      ))

    it('finds a selector for "items.0"', () =>
      expect(service.getSelector(['items', '0'])).to.be.eq(
        ENEMY_SELECTORS.children.items.children.$,
      ))

    it('finds a selector for "items.0.id"', () =>
      expect(service.getSelector(['items', '0', 'id'])).to.be.eq(
        ENEMY_SELECTORS.children.items.children.$.children.id,
      ))

    it('finds a selector for "items.0.rate"', () =>
      expect(service.getSelector(['items', '0', 'rate'])).to.be.eq(
        ENEMY_SELECTORS.children.items.children.$.children.rate,
      ))

    it('finds a selector for "triangles"', () =>
      expect(service.getSelector(['triangles'])).to.be.eq(
        ENEMY_SELECTORS.children.triangles,
      ))

    it('finds a selector for "triangles.0"', () =>
      expect(service.getSelector(['triangles', '0'])).to.be.eq(
        ENEMY_SELECTORS.children.triangles.children.$,
      ))

    it('finds a selector for "triangles.0.0"', () =>
      expect(service.getSelector(['triangles', '0', '0'])).to.be.eq(
        ENEMY_SELECTORS.children.triangles.children.$.children.$,
      ))

    it('finds a selector for "triangles.0.1"', () =>
      expect(service.getSelector(['triangles', '0', '1'])).to.be.eq(
        ENEMY_SELECTORS.children.triangles.children.$.children.$,
      ))

    it('finds a selector for "triangles.0.2"', () =>
      expect(service.getSelector(['triangles', '0', '2'])).to.be.eq(
        ENEMY_SELECTORS.children.triangles.children.$.children.$,
      ))

    it('throws an error when an invalid path is provided: "triangles.0.3"', () =>
      expect(() => service.getSelector(['triangles', '0', '3'])).to.throw(PathError))

    describe('array model', () => {
      beforeEach(() => {
        service = new FormService(ITEMS_MODEL, ITEMS_SELECTORS, onChangeSpy)
      })

      it('finds a selector for root', () =>
        expect(service.getSelector([])).to.be.eql(ITEMS_SELECTORS))

      it('finds a selector for "0"', () =>
        expect(service.getSelector(['0'])).to.be.eql(ITEMS_SELECTORS.children.$))

      it('finds a selector for "0.id"', () =>
        expect(service.getSelector(['0', 'id'])).to.be.eql(
          ITEMS_SELECTORS.children.$.children.id,
        ))

      it('finds a selector for "0.name"', () =>
        expect(service.getSelector(['0', 'name'])).to.be.eql(
          ITEMS_SELECTORS.children.$.children.name,
        ))
    })
  })

  describe('unsetPristine()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeSpy)
    })

    context('when unsetting a top-level key', () => {
      beforeEach(() => {
        service.unsetPristine(['name'])
      })

      it('unsets the flag', () => expect(getLastChange()[3]).to.be.eql({
        name: false,
        job: true,
        stats: {
          attack: true,
          evasion: true,
          speed: true,
          attributes: {
            level: true,
            experience: true,
          },
        },
        ailments: [true, true, true],
        items: [
          { id: true, rate: true },
          { id: true, rate: true },
        ],
        triangles: [
          [true, true, true],
          [true, true, true],
        ],
      }))
    })

    context('when unsetting a nested key', () => {
      beforeEach(() => {
        service.unsetPristine(['stats', 'attack'])
      })

      it('unsets the flag', () => expect(getLastChange()[3]).to.be.eql({
        name: true,
        job: true,
        stats: {
          attack: false,
          evasion: true,
          speed: true,
          attributes: {
            level: true,
            experience: true,
          },
        },
        ailments: [true, true, true],
        items: [
          { id: true, rate: true },
          { id: true, rate: true },
        ],
        triangles: [
          [true, true, true],
          [true, true, true],
        ],
      }))
    })

    context('when unsetting on an invalid path', () => {
      const INVALID_PATH = ['stats', 'attack', '0']
      const fn = () => service.unsetPristine(INVALID_PATH)

      it('throws an error', () =>
        expect(fn).to.throw(TypeError, `Invalid path: ${INVALID_PATH.join('.')}`))
    })

    context('when setting on a branch instead of a leaf', () => {
      const INVALID_PATH = ['stats']
      const fn = () => service.unsetPristine(INVALID_PATH)

      it('throws an error', () =>
        expect(fn).to.throw(TypeError, `Invalid path: ${INVALID_PATH.join('.')}`))
    })
  })

  describe('apply()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeSpy)
    })

    it('invokes onChange', () =>
      expect(getLastChange()).to.be.eql([
        false, ENEMY_MODEL, ENEMY_ERRORS, ENEMY_PRISTINE,
      ]))

    context('when modifying a top-level property', () => {
      const EXPECTED_STATE = {
        ...ENEMY_MODEL,
        name: 'Goblin',
      }

      const PRISTINE = {
        ...ENEMY_PRISTINE,
        name: false,
      }

      beforeEach(() => {
        service.apply('name', 'Goblin')
      })

      it('is not longer pristine', () =>
        expect(service.isPristine).to.be.false)

      it('invokes onChange', () => expect(getLastChange()).to.be.eql([
        true, EXPECTED_STATE, ENEMY_ERRORS, PRISTINE,
      ]))
    })

    context('when modifying a sub-object property', () => {
      const PRISTINE = {
        ...ENEMY_PRISTINE,
        stats: {
          ...ENEMY_PRISTINE.stats,
          attack: false,
        },
      }

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
        true, EXPECTED_STATE, ENEMY_ERRORS, PRISTINE,
      ]))
    })

    context('when modifying an item in an array', () => {
      const AILMENT_ID = '42'
      const EXPECTED = ENEMY_MODEL.ailments.map((mod, index) =>
        (index === 1 ? AILMENT_ID : mod))

      beforeEach(() => {
        service.apply('ailments.1', AILMENT_ID)
      })

      it('modifies the correct element', () =>
        expect(service.__state.ailments).to.be.eql(EXPECTED))
    })

    context('when modifying a value to null', () => {
      const MODEL = {
        date: null,
      }

      const fn = () => service.apply('date', null)

      beforeEach(() => {
        service = new FormService(MODEL, {}, onChangeSpy)
      })

      it('throws an error', () => expect(fn).to.not.throw())
    })

    context('when modifying an object to null', () => {
      const SELECTORS = {
        children: {
          stats: {
            clipPristine: true,
          },
        },
      }

      const PRISTINE = {
        ...ENEMY_PRISTINE,
        stats: false,
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
        true, EXPECTED_STATE, ENEMY_ERRORS, PRISTINE,
      ]))

      context('when modifying a null value to object', () => {
        beforeEach(() => {
          service.apply('stats', ENEMY_MODEL.stats)
        })

        it('invokes onChange', () => expect(getLastChange()).to.be.eql([
          false, ENEMY_MODEL, ENEMY_ERRORS, PRISTINE,
        ]))
      })
    })

    context('when modifying a key that does not exist', () => {
      const NAME_INVALID = 'asdf'
      const fn = () => service.apply(NAME_INVALID)

      it('throws an error', () =>
        expect(fn).to.throw(TypeError, `Invalid path: ${NAME_INVALID}`))
    })

    context('when mutating an object to a primitive', () => {
      const SELECTORS = {
        children: {
          stats: {
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('stats', '')

      beforeEach(() => {
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)
      })

      it('throws an error', () => expect(fn).to.throw(MutationError))
    })

    context('when mutating an object to have a different shape', () => {
      const SELECTORS = {
        children: {
          stats: {
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('stats', { id: '' })

      beforeEach(() => {
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)
      })

      it('throws an error', () => expect(fn).to.throw(MutationError))
    })

    context('when mutating an object to have the same shape', () => {
      const SELECTORS = {
        children: {
          stats: {
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('stats', {
        attack: 'a',
        evasion: 'b',
        speed: 'c',
        attributes: {
          level: 1,
          experience: 0,
        },
      })

      beforeEach(() => {
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)
      })

      it('throws an error', () => expect(fn).to.not.throw())
    })

    context.skip('when adding a rogue property to sub-object', () => {
      const fn = () => service.apply('stats.asdf', 42)

      it('throws an error', () => expect(fn).to.throw(MutationError))
    })

    context('when mutating an array', () => {
      const MODEL = { items: [{ id: '', name: '' }] }

      const SELECTORS = {
        children: {
          items: {
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('items', [])

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('throws an error', () => expect(fn).to.throw(MutationError))
    })

    context('when mutating an array while allowing unsafe mutations', () => {
      const MODEL = { items: [{ id: '', name: '' }] }

      const SELECTORS = {
        children: {
          items: {
            unsafe: true,
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('items', [])

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('does not throws an error', () => expect(fn).to.not.throw())
    })

    context('when modifying a key that does not have pristine status', () => {
      const fn = () => service.apply('stats', {
        attack: 'a',
        evasion: 'b',
        speed: 'c',
      })

      it('throws an error', () => expect(fn).to.throw(PristineError))
    })

    context('when state is accidentally set on a value', () => {
      const fn = () => service.apply('asdf', service.__state)

      it('throw the error', () => expect(fn).to.throw(MutationError))
    })

    describe('array model', () => {
      context('when path is empty', () => {
        const MODEL = ['']
        const SELECTORS = {
          clipPristine: true,
        }

        const fn = () => service.apply('', ['asdf'])

        beforeEach(() => {
          service = new FormService(MODEL, SELECTORS, onChangeSpy)
        })

        it('does not throws an error', () => expect(fn).to.not.throw())
      })

      context('when path is numeric', () => {
        const MODEL = ['']
        const fn = () => service.apply(0, 'asdf')

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeSpy)
        })

        it('does not throws an error', () => expect(fn).to.not.throw())
      })

      context('when modifying an item', () => {
        beforeEach(() => {
          service = new FormService(ITEMS_MODEL, {}, onChangeSpy)
          service.apply('0.name', 'asdf')
        })

        it('invokes the callback', () =>
          expect(getLastChange()).to.be.eql([
            true,
            [{ id: '', name: 'asdf' }],
            [{ id: '', name: '' }],
            [{ id: true, name: false }],
          ]))
      })
    })
  })

  describe('addItem()', () => {
    const MODEL = { items: [] }

    context('when an object is added', () => {
      const MODEL = {
        items: [1, 2, 3, 5, 8],
      }

      const SELECTORS = {
        children: {
          items: {
            createItem: (keyPath, _index, model) => {
              const items = getValueByPath(model, keyPath)
              const prevTwo = items.slice(items.length - 2, items.length)

              return (prevTwo[0] || 0) + (prevTwo[1] || 0)
            },
            children: {
              $: {
                format: v => toCurrency(v / 100),
                unformat: v => Number(toNumeric(v)),
              },
            },
          },
        },
      }

      let spy
      let result

      beforeEach(() => {
        spy = sandbox.spy(SELECTORS.children.items, 'createItem')

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
        result = service.build().items
      })

      it('invokes createItem() with the correct arguments', () =>
        expect(spy).to.be.calledWith(['items'], 5, MODEL, service))

      it('adds the next Fibonacci number in the sequence', () =>
        expect(result).to.be.eql([1, 2, 3, 5, 8, 13]))
    })

    context('when adding a primitive item', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => '',
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).to.be.eql({ items: [''] }))

      context('when adding an item to end of an array', () => {
        const EXPECTED = ['', '']

        beforeEach(() => {
          service.addItem('items')
        })

        it('adds it', () => expect(service.__state.items).to.be.eql(EXPECTED))

        context('when adding an item in the middle of an array', () => {
          const EXPECTED = ['1', '', '2']

          beforeEach(() => {
            service.apply('items.0', '1')
            service.apply('items.1', '2')
            service.addItem('items', 1)
          })

          it('adds it', () => expect(service.__state.items).to.be.eql(EXPECTED))
        })
      })
    })

    context('when adding an object', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({ id: '' }),
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(getLastChange()).to.be.eql([
          true,
          { items: [{ id: '' }] },
          { items: [{ id: '' }] },
          { items: [{ id: true }] },
        ]))
    })

    context('when adding an object with validators on the array selector', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({ id: '' }),
            validators: [],
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(getLastChange()).to.be.eql([
          true,
          { items: [{ id: '' }] },
          { items: '' },
          { items: [{ id: true }] },
        ]))
    })

    context('when adding an object with validators on the array element selector', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({ id: '' }),
            children: {
              $: {
                validators: [],
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(getLastChange()).to.be.eql([
          true,
          { items: [{ id: '' }] },
          { items: [''] },
          { items: [{ id: true }] },
        ]))
    })

    context('when adding an object with formatter on element', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({
              id: '',
              name: '',
              amount: 0,
            }),
            children: {
              $: {
                format: v => ({ ...v, amount: toCurrency(v.amount) }),
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(service.__state).to.be.eql({
          items: [{
            id: '',
            name: '',
            amount: '$0.00',
          }],
        }))
    })

    context('when adding an object with formatter on property of element', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({
              id: '',
              name: '',
              amount: 0,
            }),
            children: {
              $: {
                children: {
                  amount: {
                    format: v => toCurrency(v),
                  },
                },
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(service.__state).to.be.eql({
          items: [{
            id: '',
            name: '',
            amount: '$0.00',
          }],
        }))
    })

    context('when adding an object item', () => {
      const MODEL = {
        items: [
          {
            start: { hours: 8, minutes: 0, period: PERIOD.AM },
            end: { hours: 12, minutes: 0, period: PERIOD.PM },
          },
        ],
      }

      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({
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
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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

    describe('array model', () => {
      context('when path is empty', () => {
        const MODEL = ['']
        const SELECTORS = {
          createItem: () => '',
        }

        beforeEach(() => {
          service = new FormService(MODEL, SELECTORS, onChangeSpy)
          service.addItem('')
        })

        it('adds the item', () =>
          expect(service.__state).to.be.eql(['', '']))
      })

      context('when adding an item with validators', () => {
        const SELECTORS = {
          createItem: () => ({ id: '', name: '' }),
          validators: [],
        }

        beforeEach(() => {
          service = new FormService(ITEMS_MODEL, SELECTORS, onChangeSpy)
          service.addItem('')
        })

        it('invokes the callback', () =>
          expect(getLastChange()).to.be.eql([
            true,
            [
              { id: '', name: '' },
              { id: '', name: '' },
            ],
            '',
            [
              { id: true, name: true },
              { id: true, name: true },
            ],
          ]))
      })
    })
  })

  describe('removeItem()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeSpy)
    })

    context('when removing an item from the end of an array', () => {
      beforeEach(() => {
        service.removeItem('ailments')
      })

      it('removes it', () =>
        expect(service.__state.ailments).to.be.eql([3, 4]))
    })

    context('when removing an item from the front of an array', () => {
      beforeEach(() => {
        service.removeItem('ailments', 0)
      })

      it('removes it', () =>
        expect(service.__state.ailments).to.be.eql([4, 7]))
    })

    describe('array model', () => {
      context('when path is empty', () => {
        const MODEL = ['']

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeSpy)
          service.removeItem('')
        })

        it('removes the item', () =>
          expect(service.__state).to.be.eql([]))
      })
    })
  })

  describe('moveItem()', () => {
    const EXPECTED_STATE = [7, 3, 4]
    const EXPECTED_PRISTINE = [false, true, true]
    const EXPECTED_ERRORS = 'asdf'
    const SELECTORS = {
      children: {
        ailments: [failValidator],
      },
    }

    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)

      service.apply('ailments.2', 7)
      service.apply('ailments.2', 7)
      service.moveItem('ailments', 2, 0)
    })

    it('reorders the item in the state', () =>
      expect(service.__state.ailments).to.be.eql(EXPECTED_STATE))

    it('reorders the item in the error schema', () =>
      expect(service.__errors.ailments).to.be.eql(EXPECTED_ERRORS))

    it('reorders the item in the pristine schema', () =>
      expect(service.__pristine.ailments).to.be.eql(EXPECTED_PRISTINE))

    describe('array model', () => {
      context('when path is empty', () => {
        const MODEL = ['a', 'b', 'c']

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeSpy)
          service.moveItem('', 2, 1)
        })

        it('moves the item', () =>
          expect(service.__state).to.be.eql(['a', 'c', 'b']))
      })
    })
  })

  describe('swapItems()', () => {
    const EXPECTED_STATE = [7, 4, 3]
    const EXPECTED_PRISTINE = [false, true, false]
    const EXPECTED_ERRORS = 'asdf'
    const SELECTORS = {
      children: {
        ailments: [failValidator],
      },
    }

    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)
      service.apply('ailments.2', 7)
      service.apply('ailments.2', 7)
      service.swapItems('ailments', 2, 0)
    })

    it('swaps the selected items in the state', () =>
      expect(service.__state.ailments).to.be.eql(EXPECTED_STATE))

    it('swaps the selected items in the error schema', () =>
      expect(service.__errors.ailments).to.be.eql(EXPECTED_ERRORS))

    it('swaps the selected items in the pristine schema', () =>
      expect(service.__pristine.ailments).to.be.eql(EXPECTED_PRISTINE))

    describe('array model', () => {
      context('when path is empty', () => {
        const MODEL = ['a', 'b', 'c']

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeSpy)
          service.swapItems('', 2, 0)
        })

        it('swaps the items', () =>
          expect(service.__state).to.be.eql(['c', 'b', 'a']))
      })
    })
  })

  describe('validate()', () => {
    let valid

    const NAME_MATCH = 'asdf'
    const VALIDATOR_NAME_MATCH = {
      error: 'Invalid',
      validate: v => v === NAME_MATCH,
    }

    context('when clipPristine is set on a key with children', () => {
      let validatorStub
      beforeEach(() => {
        const MODEL = {
          amount: {
            hi: 2,
            three: '3',
          },
        }

        const SELECTORS = {
          children: {
            amount: {
              clipPristine: true,
              validators: [
                {
                  error: 'error on clipped object',
                  validate: () => true,
                },
              ],
            },
          },
        }

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        validatorStub = sandbox.spy(service, 'validateKey')
        valid = service.validate()
      })

      it('only calls validator once', () => expect(validatorStub).to.be.calledOnce)
    })

    context('when invalid data is provided', () => {
      beforeEach(() => {
        const MODEL = {
          name: '',
          description: '',
          amount: '',
        }

        const SELECTORS = {
          children: {
            name: [isRequired()],
          },
        }

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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
        {
          name: false,
          description: false,
          amount: false,
        },
      ]))
    })

    context('when valid data is provided', () => {
      const MODEL = { name: 'asdf' }

      const SELECTORS = {
        children: {
          name: [isRequired()],
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        valid = service.validate()
      })

      it('passes', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { name: 'asdf' },
        { name: '' },
        { name: false },
      ]))
    })

    context('when invalid data is provided (multiple validators)', () => {
      const MODEL = { name: 'Wronguy' }

      const SELECTORS = {
        children: {
          name: [isRequired(), VALIDATOR_NAME_MATCH],
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        valid = service.validate()
      })

      it('fails', () => expect(valid).to.be.false)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        { name: 'Wronguy' },
        { name: 'Invalid' },
        { name: false },
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
            { name: false },
          ])
        )
      })
    })

    context('when validating across multiple levels of selectors', () => {
      const MODEL = { tax: { name: '', rate: '' } }
      const SELECTORS = {
        children: {
          tax: {
            children: {
              rate: [
                isRequiredIf('name'),
                inRange(0, 100, false, false, '0 - 100'),
              ],
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        valid = service.validate()
      })

      it('passes', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        MODEL,
        { tax: { name: '', rate: '' } },
        { tax: { name: false, rate: false } },
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
          { tax: { name: false, rate: false } },
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
            { tax: { name: false, rate: false } },
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
              { tax: { name: false, rate: false } },
            ]))
          })
        })

        context('when clearing the name', () => {
          beforeEach(() => {
            service.apply('tax.name', '')
            valid = service.validate()
          })

          it('passes again', () => expect(valid).to.be.true)

          it('invokes callback', () => expect(getLastChange()).to.be.eql([
            false,
            { tax: { name: '', rate: '' } },
            { tax: { name: '', rate: '' } },
            { tax: { name: false, rate: false } },
          ]))
        })
      })
    })

    context('when errors are clipped', () => {
      const MODEL = {
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
      }

      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({
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
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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
      const MODEL = { phones: SCHEMA_PHONES_EMPTY }
      const ERRORS = map(MODEL, () => '')
      const PRISTINE = map(ERRORS, () => false)
      const SELECTORS = {
        children: {
          phones: {
            createItem: () => ({ number: '', type: '' }),
            children: {
              $: {
                children: {
                  number: [isPhoneNumber()],
                  type: [isRequiredIf('number')],
                },
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        valid = service.validate()
      })

      it('is valid', () => expect(valid).to.be.true)

      it('invokes callback', () => expect(getLastChange()).to.be.eql([
        false,
        MODEL,
        ERRORS,
        PRISTINE,
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
      const MODEL = { rate: '' }
      const SELECTORS = {
        children: {
          rate: {
            ignorePristine: true,
            validators: [inRange(0, 100, false, false, '0 - 100')],
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.apply('rate', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).to.be.eql({ rate: '0 - 100' }))
    })

    context('when ignoring pristine status of a key (array)', () => {
      const MODEL = { rates: [''] }
      const SELECTORS = {
        children: {
          rates: {
            createItem: () => '',
            children: {
              $: {
                ignorePristine: true,
                validators: [inRange(0, 100, false, false, '0 - 100')],
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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
      const MODEL = { taxes: [{ name: '', rate: '' }] }
      const SELECTORS = {
        children: {
          taxes: {
            createItem: () => ({ name: '', rate: '' }),
            children: {
              $: {
                children: {
                  rate: {
                    ignorePristine: true,
                    validators: [inRange(0, 100, false, false, '0 - 100')],
                  },
                },
              },
            },
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeSpy)
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

    context('when model is an array', () => {
      const SELECTORS = {
        createItem: () => ({ id: '', name: '' }),
        validators: [{
          error: 'Invalid',
          validate: v => v[0].name === 'asdf',
        }],
      }

      let valid

      beforeEach(() => {
        service = new FormService(ITEMS_MODEL, SELECTORS, onChangeSpy)
        service.apply('0.name', 'asdf')
        valid = service.validate()
      })

      it('passes validation', () => expect(valid).to.be.true)

      context('when validation fails', () => {
        beforeEach(() => {
          service.apply('0.name', '')
          valid = service.validate()
        })

        it('fails', () => expect(valid).to.be.false)
      })
    })

    context('when selector validates against unformatted value', () => {
      const AMOUNT_RAW = 3.5
      const MODEL = {
        amount: AMOUNT_RAW,
      }

      const SELECTORS = {
        children: {
          amount: {
            validateRaw: true,
            format: v => toCurrency(v),
            unformat: v => Number(toNumeric(v, true)),
            validators: [
              {
                error: 'asdf',
                validate: raw => raw,
              },
            ],
          },
        },
      }

      let validator

      beforeEach(() => {
        validator = SELECTORS.children.amount.validators[0]
        validator.validate = sandbox.stub().returns(true)

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
        service.validate()
      })

      it('unformats the value', () =>
        expect(validator.validate).to.be.calledOnceWith(
          AMOUNT_RAW,
          ['amount'],
          MODEL,
        ))
    })

    context('when manually validating a key', () => {
      const AMOUNT_RAW = 3.5
      const MODEL = {
        amount: AMOUNT_RAW,
      }

      const SELECTORS = {
        children: {
          amount: {
            validateManually: true,
            format: v => toCurrency(v),
            unformat: v => Number(toNumeric(v, true)),
            validators: [
              {
                error: 'asdf',
                validate: v => v,
              },
            ],
          },
        },
      }

      let validator

      beforeEach(() => {
        validator = SELECTORS.children.amount.validators[0]
        validator.validate = sandbox.stub().returns(true)

        service = new FormService(MODEL, SELECTORS, onChangeSpy)
      })

      it('does not invoke the validator', () =>
        expect(validator.validate).to.not.be.called)

      context('when manually validating', () => {
        beforeEach(() => {
          service.validate()
        })

        it('invokes the validator', () =>
          expect(validator.validate).to.be.calledOnce)
      })
    })
  })

  describe('refresh()', () => {
    const UPDATED_MODEL = {
      name: 'Cecil',
      job: 'dark_knight',
      stats: {
        attack: 7,
        evasion: 3,
        speed: 3,
        attributes: {
          level: 5,
          experience: 0,
        },
      },
      somethingId: null,
      ailments: [],
      items: [
        { id: 1, rate: 0.1 },
      ],
      triangles: [],
    }

    const UPDATED_ERRORS = {
      name: '',
      job: '',
      stats: {
        attack: '',
        evasion: '',
        speed: '',
        attributes: {
          level: '',
          experience: '',
        },
      },
      somethingId: '',
      ailments: [],
      items: [
        { id: '', rate: '' },
      ],
      triangles: [],
    }

    const UPDATED_PRISTINE = map(UPDATED_ERRORS, () => true)

    const SELECTORS = {
      children: {
        name: [failValidator],
        somethingId: {
          unsafe: true,
          clipPristine: true,
          format: v => [].find(item => item.data.id === v) || { data: { id: '' }, label: '' },
          unformat: v => v.data.id,
        },
      },
    }

    beforeEach(() => {
      service = new FormService({ ...ENEMY_MODEL, somethingId: null }, SELECTORS, onChangeSpy)
      service.apply('name', 'asdf')
      service.validate()
      service.refresh(UPDATED_MODEL)
    })

    it('reverts state, errors, pristine, and dirtiness back', () =>
      expect(getLastChange()).to.be.eql([
        false, { ...UPDATED_MODEL, somethingId: { data: { id: '' }, label: '' } }, { ...UPDATED_ERRORS, somethingId: { data: { id: '' }, label: '' } }, UPDATED_PRISTINE,
      ]))
  })

  describe('reset()', () => {
    const SELECTORS = {
      children: {
        name: [failValidator],
      },
    }

    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, SELECTORS, onChangeSpy)
      service.apply('name', 'asdf')
      service.validate()
      service.reset()
    })

    it('reverts state, errors, pristine and dirtiness back', () =>
      expect(getLastChange()).to.be.eql([
        false, ENEMY_MODEL, ENEMY_ERRORS, ENEMY_PRISTINE,
      ]))
  })
})
