import pkg from 'validator'
import FormService from './service'

import {
  mock,
  spyOn,
  beforeEach,
  afterEach,
  describe,
  it,
  test,
  expect,
} from 'bun:test'

import {
  VerificationError,
  PristineError,
  MutationError,
  PathError,
} from './error'

import {
  extents,
  padArray,
  filterEmpty,
  map,
  getValueByPath,
} from './utils'

const PERIOD = {
  AM: 'am',
  PM: 'pm',
}

const ENEMY_MODEL = {
  name: 'Gremlin',
  job: 'monster',
  stats: {
    attack: 4,
    evasion: 3,
    speed: 2,
    attributes: {
      level: 9,
      experience: 1000,
    },
  },
  ailments: [3, 4, 7],
  items: [
    { id: 1, rate: 0.1 },
    { id: 3, rate: 0.4 },
  ],
  triangles: [
    [0, 1, 2],
    [0, 2, 3],
  ],
}

const ENEMY_ERRORS = {
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
  ailments: ['', '', ''],
  items: [
    { id: '', rate: '' },
    { id: '', rate: '' },
  ],
  triangles: [
    ['', '', ''],
    ['', '', ''],
  ],
}

const ENEMY_PRISTINE = map(ENEMY_ERRORS, () => true)

const ENEMY_SELECTORS = {
  format: v => v,
  unformat: v => v,
  children: {
    name: {
      format: v => v,
      unformat: v => v,
    },
    // 'job' is intentionally left out...
    stats: {
      format: v => v,
      unformat: v => v,
      children: {
        attack: {
          format: v => v,
          unformat: v => v,
        },
        evasion: {
          format: v => v,
          unformat: v => v,
        },
        speed: {
          format: v => v,
          unformat: v => v,
        },
        attributes: {
          format: v => v,
          unformat: v => v,
          children: {
            level: {
              format: v => v,
              unformat: v => v,
            },
            experience: {
              format: v => v,
              unformat: v => v,
            },
          },
        },
      },
    },
    ailments: {
      format: v => v,
      unformat: v => v,
      children: {
        $: {
          format: v => v,
          unformat: v => v,
        },
      },
    },
    items: {
      format: v => v,
      unformat: v => v,
      children: {
        $: {
          format: v => v,
          unformat: v => v,
          children: {
            id: {
              format: v => v,
              unformat: v => v,
            },
            rate: {
              format: v => v,
              unformat: v => v,
            },
          },
        },
      },
    },
    triangles: {
      format: v => v,
      unformat: v => v,
      children: {
        $: {
          format: v => v,
          unformat: v => v,
          children: {
            $: {
              format: v => v,
              unformat: v => v,
            },
          },
        },
      },
    },
  },
}

const ITEMS_MODEL = [
  { id: '', name: '' },
]

const ITEMS_SELECTORS = {
  genItem: () => ({ id: '', name: '' }),
  format: v => v,
  unformat: v => v,
  children: {
    $: {
      format: v => v,
      unformat: v => v,
      children: {
        id: {
          format: v => v,
          unformat: v => v,
        },
        name: {
          format: v => v,
          unformat: v => v,
        },
      },
    },
  },
}

function toNumeric (str, allowDecimal = false) {
  return str.replace(allowDecimal ? /\$|,/g : /\D/g, '')
}

function toCurrency (v) {
  return `$${(Number(v))
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}`
}

function toPhoneNumber (str) {
  const segments = [str.slice(0, 3), str.slice(3, 6), str.slice(6, 10)]

  if (str.length < 4) {
    return segments[0]
  }

  if (str.length < 7) {
    return `(${segments[0]}) ${segments[1]}`
  }

  return `(${segments[0]}) ${segments[1]}-${segments[2]}`
}

function hoursToObj (v) {
  return {
    hours: Math.floor(v > 12 ? v - 12 : v),
    minutes: (v - Math.floor(v)) * 60,
    period: v >= 12 ? PERIOD.PM : PERIOD.AM,
  }
}

function objToHours (v) {
  const model = map(v, (keyPath, value) =>
    (keyPath[0] !== 'period' ? Number(value) : value))

  const offset = model.period === PERIOD.PM ? 12 : 0

  return model.hours + (model.minutes / 60) + offset
}

function timeToScalar (time) {
  const periodToMinutes =
    time.period === PERIOD.PM && time.hours !== 12 ? 720 : 0

  return periodToMinutes + (time.hours * 60) + (time.minutes)
}

function isRequired (error = 'Required') {
  return {
    error,
    validate: v => (Array.isArray(v) ? v.length : v),
  }
}

function isRequiredIf (siblingKey, autoValidate = true, error = 'Required') {
  return {
    error,
    validate: (v, keyPath, state, service) => {
      const siblingPath = [...keyPath.slice(0, keyPath.length - 1), siblingKey]

      if (autoValidate) {
        service.validateKey(siblingPath)
      }

      return getValueByPath(state, siblingPath) ? v : true
    },
  }
}

function isPhoneNumber (error = 'Invalid phone number') {
  return {
    error,
    validate: v => !v || pkg.isMobilePhone(v),
  }
}

function inRange (ext1, ext2, incMin = true, incMax = true, error = null) {
  const { min, max } = extents(Number(ext1), Number(ext2))

  return {
    error: error || `${min} - ${max}`,
    validate: v => {
      const passesMin = incMin ? (v >= min) : (v > min)
      const passesMax = incMax ? (v <= max) : (v < max)

      return v === '' || (passesMin && passesMax)
    },
  }
}

const passValidator = {
  error: '',
  validator: () => true,
}

const failValidator = {
  error: 'asdf',
  validate: () => false,
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

describe('FormService', () => {
  let service
  let onChangeMock

  const getLastChange = () => onChangeMock.mock.calls.at(-1)

  beforeEach(() => {
    onChangeMock = mock()
  })

  afterEach(() => {
    mock.restore()
  })

  describe('verify', () => {
    const MODEL = {
      stats: {
        a: '',
      },
    }

    test('when nested validators are found', () => {
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

      const fn = () => new FormService(MODEL, SELECTORS, onChangeMock)

      expect(fn).toThrow(
        new VerificationError(
          'Selector (stats.a) has ancestor selector with validators: stats',
        ),
      )
    })

    test('when setting ignorePristine on object-type key', () => {
      const SELECTORS = {
        children: {
          stats: {
            ignorePristine: true,
          },
        },
      }

      const fn = () => new FormService(MODEL, SELECTORS, onChangeMock)

      expect(fn).toThrow(
        new VerificationError(
          'ignorePristine set object-type key for path: stats. Perhaps you meant to use clipPristine?',
        ),
      )
    })
  })

  describe('formatters', () => {
    const TIME_NUM = 4.25

    const TIME_OBJ = {
      hours: 4,
      minutes: 15,
      period: PERIOD.AM,
    }

    test('when format() is provided on a selector', () => {
      const formatMock = mock(v => toCurrency(v / 100))

      const MODEL = {
        amount: 42,
      }

      const SELECTORS = {
        children: {
          amount: {
            format: formatMock,
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      expect(service.state).toStrictEqual({ amount: '$0.42' })
    })

    test('when unformat() is provided on a selector', () => {
      const unformatMock = mock(v => Number(toNumeric(v, true)) * 100)

      const MODEL = {
        amount: '$0.42',
      }

      const SELECTORS = {
        children: {
          amount: {
            unformat: unformatMock,
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)
      const model = service.build()

      expect(model).toStrictEqual({ amount: 42 })
    })

    test('when formatting from primitive to object', () => {
      const MODEL = {
        time: TIME_NUM,
      }

      const SELECTORS = {
        children: {
          time: {
            format: v => hoursToObj(v),
            unformat: v => objToHours(v),
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)
      const model = service.build()

      expect(service.state).toStrictEqual({ time: TIME_OBJ })
      expect(model).toStrictEqual({ time: TIME_NUM })
    })

    test('when formatting from object to primitive', () => {
      const MODEL = {
        time: TIME_OBJ,
      }

      const SELECTORS = {
        children: {
          time: {
            format: v => objToHours(v),
            unformat: v => hoursToObj(v),
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)
      const model = service.build()

      expect(service.state).toStrictEqual({ time: TIME_NUM })
      expect(model).toStrictEqual({ time: TIME_OBJ })
    })

    test('when converters are provided to array items', () => {
      const ITEM_ADDED_HOURS = 8

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
                format: v => hoursToObj(v),
                unformat: v => objToHours(v),
              },
            },
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)
      const model = service.build()

      expect(service.state).toStrictEqual(STATE)
      expect(model).toStrictEqual(MODEL)
    })

    test('when providing nested formatters', () => {
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

      const service = new FormService(MODEL, SELECTORS, onChangeMock)
      const model = service.build()

      expect(service.state).toStrictEqual(STATE)
      expect(model).toStrictEqual(MODEL)
    })

    test('when formatting the root (object)', () => {
      const MODEL = {
        amount: 42,
      }

      const SELECTORS = {
        format: v => ({
          amount: toCurrency(v.amount / 100),
        }),
        unformat: v => ({
          amount: Number(toNumeric(v.amount, true)) * 100,
        }),
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)
      const model = service.build()

      expect(service.state).toStrictEqual({ amount: '$0.42' })
      expect(model).toStrictEqual({ amount: 42 })
    })
  })

  describe('clipPristine', () => {
    test('when clipping an object', () => {
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
          type: {
            clipPristine: true,
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      expect(service.pristine).toStrictEqual({
        id: true,
        name: true,
        type: true,
      })
    })

    test('when clipping an array', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [
          {
            label: 'Default',
            value: null,
          },
        ],
      }

      const SELECTORS = {
        children: {
          types: {
            clipPristine: true,
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      expect(service.pristine).toStrictEqual({
        id: true,
        name: true,
        types: true,
      })
    })

    test('when clipping the object-elements in an array', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [
          {
            label: 'Default',
            value: null,
          },
        ],
      }

      const SELECTORS = {
        children: {
          types: {
            children: {
              $: {
                clipPristine: true,
              },
            },
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      expect(service.pristine).toStrictEqual({
        id: true,
        name: true,
        types: [true],
      })
    })

    test('when clipping the object-elements in an array (add item)', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [],
      }

      const SELECTORS = {
        children: {
          types: {
            createItem: () => ({
              label: '',
              value: null,
            }),
            children: {
              $: {
                clipPristine: true,
              },
            },
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      service.addItem('types')

      expect(service.pristine).toStrictEqual({
        id: true,
        name: true,
        types: [true],
      })
    })

    test('when clipping the object-elements in an array (remove item)', () => {
      const MODEL = {
        id: '123',
        name: 'Test',
        types: [
          {
            label: 'Default',
            value: null,
          },
        ],
      }

      const SELECTORS = {
        children: {
          types: {
            children: {
              $: {
                clipPristine: true,
              },
            },
          },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      service.removeItem('types')

      expect(service.pristine).toStrictEqual({
        id: true,
        name: true,
        types: [],
      })
    })
  })

  describe('refresh()', () => {
    test('when invoked', () => {
      const MODEL_INITIAL = {
        name: '',
      }

      const MODEL_UPDATED = {
        name: 'asdf',
      }

      const SELECTORS = {
        children: {
          name: [failValidator],
        },
      }

      const service = new FormService(MODEL_INITIAL, SELECTORS, onChangeMock)

      service.apply('name', 'asdf')
      service.validate()
      service.refresh(MODEL_UPDATED)

      expect(getLastChange()).toEqual([
        false,
        MODEL_UPDATED,
        { name: '' },
        { name: true },
      ])
    })
  })

  describe('reset()', () => {
    test('when invoked', () => {
      const MODEL = {
        name: '',
      }

      const SELECTORS = {
        children: {
          name: [failValidator],
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      service.apply('name', 'asdf')
      service.validate()
      service.reset()

      expect(getLastChange()).toEqual([
        false,
        MODEL,
        { name: '' },
        { name: true },
      ])
    })
  })

  describe('apply()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeMock)
    })

    it('invokes onChange', () =>
      expect(getLastChange()).toStrictEqual([
        false,
        ENEMY_MODEL,
        ENEMY_ERRORS,
        ENEMY_PRISTINE,
      ]))

    describe('when modifying a top-level property', () => {
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
        expect(service.isPristine).toBe(false))

      it('invokes onChange', () => expect(getLastChange()).toEqual([
        true, EXPECTED_STATE, ENEMY_ERRORS, PRISTINE,
      ]))
    })

    describe('when modifying a sub-object property', () => {
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

      it('invokes onChange', () => expect(getLastChange()).toEqual([
        true, EXPECTED_STATE, ENEMY_ERRORS, PRISTINE,
      ]))
    })

    describe('when modifying an item in an array', () => {
      const AILMENT_ID = '42'
      const EXPECTED = ENEMY_MODEL.ailments.map((mod, index) =>
        (index === 1 ? AILMENT_ID : mod))

      beforeEach(() => {
        service.apply('ailments.1', AILMENT_ID)
      })

      it('modifies the correct element', () =>
        expect(service.__state.ailments).toEqual(EXPECTED))
    })

    describe('when modifying a value to null', () => {
      const MODEL = {
        date: null,
      }

      const fn = () => service.apply('date', null)

      beforeEach(() => {
        service = new FormService(MODEL, {}, onChangeMock)
      })

      it('throws an error', () => expect(fn).not.toThrow())
    })

    describe('when modifying an object to null', () => {
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
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeMock)
        service.apply('stats', null)
      })

      it('invokes onChange', () => expect(getLastChange()).toEqual([
        true, EXPECTED_STATE, ENEMY_ERRORS, PRISTINE,
      ]))

      describe('when modifying a null value to object', () => {
        beforeEach(() => {
          service.apply('stats', ENEMY_MODEL.stats)
        })

        it('invokes onChange', () => expect(getLastChange()).toEqual([
          false, ENEMY_MODEL, ENEMY_ERRORS, PRISTINE,
        ]))
      })
    })

    describe('when modifying a key that does not exist', () => {
      const NAME_INVALID = 'asdf'
      const fn = () => service.apply(NAME_INVALID)

      it('throws an error', () =>
        expect(fn).toThrow(`Invalid path: ${NAME_INVALID}`))
    })

    describe('when mutating an object to a primitive', () => {
      const SELECTORS = {
        children: {
          stats: {
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('stats', '')

      beforeEach(() => {
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeMock)
      })

      it('throws an error', () => expect(fn).toThrow(MutationError))
    })

    describe('when mutating an object to have a different shape', () => {
      const SELECTORS = {
        children: {
          stats: {
            clipPristine: true,
          },
        },
      }

      const fn = () => service.apply('stats', { id: '' })

      beforeEach(() => {
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeMock)
      })

      it('throws an error', () => expect(fn).toThrow(MutationError))
    })

    describe('when mutating an object to have the same shape', () => {
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
        service = new FormService(ENEMY_MODEL, SELECTORS, onChangeMock)
      })

      it('throws an error', () => expect(fn).not.toThrow())
    })

    test('when adding a rogue property to sub-object', () => {
      const fn = () => service.apply('stats.asdf', 42)

      expect(fn).toThrow(new TypeError('Invalid path: stats.asdf'))
    })

    describe('when mutating an array', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
      })

      it('throws an error', () => expect(fn).toThrow(MutationError))
    })

    describe('when mutating an array while allowing unsafe mutations', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
      })

      it('does not throws an error', () => expect(fn).not.toThrow())
    })

    describe('when modifying a key that does not have pristine status', () => {
      const fn = () => service.apply('stats', {
        attack: 'a',
        evasion: 'b',
        speed: 'c',
      })

      it('throws an error', () => expect(fn).toThrow(PristineError))
    })

    describe('when state is accidentally set on a value', () => {
      const fn = () => service.apply('asdf', service.__state)

      it('throw the error', () => expect(fn).toThrow(MutationError))
    })

    describe('array model', () => {
      describe('when path is empty', () => {
        const MODEL = ['']
        const SELECTORS = {
          clipPristine: true,
        }

        const fn = () => service.apply('', ['asdf'])

        beforeEach(() => {
          service = new FormService(MODEL, SELECTORS, onChangeMock)
        })

        it('does not throws an error', () => expect(fn).not.toThrow())
      })

      describe('when path is numeric', () => {
        const MODEL = ['']
        const fn = () => service.apply(0, 'asdf')

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeMock)
        })

        it('does not throws an error', () => expect(fn).not.toThrow())
      })

      describe('when modifying an item', () => {
        beforeEach(() => {
          service = new FormService(ITEMS_MODEL, {}, onChangeMock)
          service.apply('0.name', 'asdf')
        })

        it('invokes the callback', () =>
          expect(getLastChange()).toStrictEqual([
            true,
            [{ id: '', name: 'asdf' }],
            [{ id: '', name: '' }],
            [{ id: true, name: false }],
          ]))
      })
    })
  })

  describe('addItem()', () => {
    describe('object model', () => {
      test('when a primitive item is added', () => {
        const createItemMock = mock((keyPath, index, model) => {
          const items = getValueByPath(model, keyPath)
          const prevTwo = items.slice(index - 2, items.length)
          const result = (prevTwo[0] || 0) + (prevTwo[1] || 0)

          return result
        })

        const MODEL = {
          items: [1, 2, 3],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items')

        const model = service.build()

        expect(model).toStrictEqual({
          items: [1, 2, 3, 5],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          3,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          { items: [1, 2, 3, 5] },
          { items: ['', '', '', ''] },
          { items: [true, true, true, true] },
        ])
      })

      test('when a primitive item is inserted', () => {
        const createItemMock = mock(() => 999)

        const MODEL = {
          items: [1, 2],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items', 1)

        const model = service.build()

        expect(model).toStrictEqual({
          items: [1, 999, 2],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          1,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          { items: [1, 999, 2] },
          { items: ['', '', ''] },
          { items: [true, true, true] },
        ])
      })

      test('when a complex item is added', () => {
        const createItemMock = mock((keyPath, index, model) => {
          const items = getValueByPath(model, keyPath)

          const prevTwo = items
            .slice(index - 2, items.length)
            .map(item => item.val)

          const val = (prevTwo[0] || 0) + (prevTwo[1] || 0)
          const char = String.fromCharCode('a'.charCodeAt(0) + val)

          return { val, char }
        })

        const MODEL = {
          items: [
            { val: 1, char: 'a' },
            { val: 2, char: 'b' },
            { val: 3, char: 'c' },
          ],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items')

        const model = service.build()

        expect(model).toStrictEqual({
          items: [
            { val: 1, char: 'a' },
            { val: 2, char: 'b' },
            { val: 3, char: 'c' },
            { val: 5, char: 'f' },
          ],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          3,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              { val: 1, char: 'a' },
              { val: 2, char: 'b' },
              { val: 3, char: 'c' },
              { val: 5, char: 'f' },
            ],
          },
          {
            items: [
              { val: '', char: '' },
              { val: '', char: '' },
              { val: '', char: '' },
              { val: '', char: '' },
            ],
          },
          {
            items: [
              { val: true, char: true },
              { val: true, char: true },
              { val: true, char: true },
              { val: true, char: true },
            ],
          },
        ])
      })

      test('when a complex item is added (with validator selector on root)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = {
          items: [],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
              validators: [],
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items')

        const model = service.build()

        expect(model).toStrictEqual({
          items: [
            {
              val: 999,
              char: 'zzz',
            },
          ],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          0,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              {
                val: 999,
                char: 'zzz',
              },
            ],
          },
          {
            items: '',
          },
          {
            items: [
              {
                val: true,
                char: true,
              },
            ],
          },
        ])
      })

      test('when a complex item is added (with validator selector on item)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = {
          items: [],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
              children: {
                $: {
                  validators: [],
                },
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items')

        const model = service.build()

        expect(model).toStrictEqual({
          items: [
            {
              val: 999,
              char: 'zzz',
            },
          ],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          0,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              {
                val: 999,
                char: 'zzz',
              },
            ],
          },
          {
            items: [''],
          },
          {
            items: [
              {
                val: true,
                char: true,
              },
            ],
          },
        ])
      })

      test('when a complex item is added (with format selector on item)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = {
          items: [],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
              children: {
                $: {
                  format: v => ({ ...v, char: v.char.toUpperCase() }),
                },
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items')

        const model = service.build()

        expect(model).toStrictEqual({
          items: [
            {
              val: 999,
              char: 'ZZZ',
            },
          ],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          0,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              {
                val: 999,
                char: 'ZZZ',
              },
            ],
          },
          {
            items: [
              {
                val: '',
                char: '',
              },
            ],
          },
          {
            items: [
              {
                val: true,
                char: true,
              },
            ],
          },
        ])
      })

      test('when a complex item is added (with format selector on item property)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = {
          items: [],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
              children: {
                $: {
                  children: {
                    char: {
                      format: v => v.toUpperCase(),
                    },
                  },
                },
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items')

        const model = service.build()

        expect(model).toStrictEqual({
          items: [
            {
              val: 999,
              char: 'ZZZ',
            },
          ],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          0,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              {
                val: 999,
                char: 'ZZZ',
              },
            ],
          },
          {
            items: [
              {
                val: '',
                char: '',
              },
            ],
          },
          {
            items: [
              {
                val: true,
                char: true,
              },
            ],
          },
        ])
      })

      test('when a complex item is inserted', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = {
          items: [
            { val: 1, char: 'a' },
            { val: 2, char: 'b' },
          ],
        }

        const SELECTORS = {
          children: {
            items: {
              createItem: createItemMock,
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('items', 1)

        const model = service.build()

        expect(model).toStrictEqual({
          items: [
            { val: 1, char: 'a' },
            { val: 999, char: 'zzz' },
            { val: 2, char: 'b' },
          ],
        })

        expect(createItemMock).toHaveBeenCalledOnce()

        expect(createItemMock).toHaveBeenCalledWith(
          ['items'],
          1,
          MODEL,
          service,
        )

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              { val: 1, char: 'a' },
              { val: 999, char: 'zzz' },
              { val: 2, char: 'b' },
            ],
          },
          {
            items: [
              { val: '', char: '' },
              { val: '', char: '' },
              { val: '', char: '' },
            ],
          },
          {
            items: [
              { val: true, char: true },
              { val: true, char: true },
              { val: true, char: true },
            ],
          },
        ])
      })
    })

    describe('array model', () => {
      test('when a primitive item is added', () => {
        const createItemMock = mock((keyPath, index, model) => {
          const items = getValueByPath(model, keyPath)
          const prevTwo = items.slice(index - 2, items.length)
          const result = (prevTwo[0] || 0) + (prevTwo[1] || 0)

          return result
        })

        const MODEL = [1, 2, 3]

        const SELECTORS = {
          createItem: createItemMock,
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('')

        const model = service.build()

        expect(model).toStrictEqual([1, 2, 3, 5])
        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 3, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [1, 2, 3, 5],
          ['', '', '', ''],
          [true, true, true, true],
        ])
      })

      test('when a primitive item is inserted', () => {
        const createItemMock = mock(() => 999)

        const MODEL = [1, 2]

        const SELECTORS = {
          createItem: createItemMock,
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('', 1)

        const model = service.build()

        expect(model).toStrictEqual([1, 999, 2])
        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 1, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [1, 999, 2],
          ['', '', ''],
          [true, true, true],
        ])
      })

      test('when a complex item is added', () => {
        const createItemMock = mock((keyPath, index, model) => {
          const items = getValueByPath(model, keyPath)

          const prevTwo = items
            .slice(index - 2, items.length)
            .map(item => item.val)

          const val = (prevTwo[0] || 0) + (prevTwo[1] || 0)
          const char = String.fromCharCode('a'.charCodeAt(0) + val)

          return { val, char }
        })

        const MODEL = [
          { val: 1, char: 'a' },
          { val: 2, char: 'b' },
          { val: 3, char: 'c' },
        ]

        const SELECTORS = {
          createItem: createItemMock,
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('')

        const model = service.build()

        expect(model).toStrictEqual([
          { val: 1, char: 'a' },
          { val: 2, char: 'b' },
          { val: 3, char: 'c' },
          { val: 5, char: 'f' },
        ])

        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 3, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            { val: 1, char: 'a' },
            { val: 2, char: 'b' },
            { val: 3, char: 'c' },
            { val: 5, char: 'f' },
          ],
          [
            { val: '', char: '' },
            { val: '', char: '' },
            { val: '', char: '' },
            { val: '', char: '' },
          ],
          [
            { val: true, char: true },
            { val: true, char: true },
            { val: true, char: true },
            { val: true, char: true },
          ],
        ])
      })

      test('when a complex item is added (with validator selector on root)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = []

        const SELECTORS = {
          createItem: createItemMock,
          validators: [],
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('')

        const model = service.build()

        expect(model).toStrictEqual([
          {
            val: 999,
            char: 'zzz',
          },
        ])

        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 0, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            {
              val: 999,
              char: 'zzz',
            },
          ],
          '',
          [
            {
              val: true,
              char: true,
            },
          ],
        ])
      })

      test('when a complex item is added (with validator selector on item)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = []

        const SELECTORS = {
          createItem: createItemMock,
          children: {
            $: {
              validators: [],
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('')

        const model = service.build()

        expect(model).toStrictEqual([
          {
            val: 999,
            char: 'zzz',
          },
        ])

        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 0, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            {
              val: 999,
              char: 'zzz',
            },
          ],
          [''],
          [
            {
              val: true,
              char: true,
            },
          ],
        ])
      })

      test('when a complex item is added (with format selector on item)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = []

        const SELECTORS = {
          createItem: createItemMock,
          children: {
            $: {
              format: v => ({ ...v, char: v.char.toUpperCase() }),
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('')

        const model = service.build()

        expect(model).toStrictEqual([
          {
            val: 999,
            char: 'ZZZ',
          },
        ])

        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 0, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            {
              val: 999,
              char: 'ZZZ',
            },
          ],
          [
            {
              val: '',
              char: '',
            },
          ],
          [
            {
              val: true,
              char: true,
            },
          ],
        ])
      })

      test('when a complex item is added (with format selector on item property)', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = []

        const SELECTORS = {
          createItem: createItemMock,
          children: {
            $: {
              children: {
                char: {
                  format: v => v.toUpperCase(),
                },
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('')

        const model = service.build()

        expect(model).toStrictEqual([
          {
            val: 999,
            char: 'ZZZ',
          },
        ])

        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 0, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            {
              val: 999,
              char: 'ZZZ',
            },
          ],
          [
            {
              val: '',
              char: '',
            },
          ],
          [
            {
              val: true,
              char: true,
            },
          ],
        ])
      })

      test('when a complex item is inserted', () => {
        const createItemMock = mock(() => ({
          val: 999,
          char: 'zzz',
        }))

        const MODEL = [
          { val: 1, char: 'a' },
          { val: 2, char: 'b' },
        ]

        const SELECTORS = {
          createItem: createItemMock,
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.addItem('', 1)

        const model = service.build()

        expect(model).toStrictEqual([
          { val: 1, char: 'a' },
          { val: 999, char: 'zzz' },
          { val: 2, char: 'b' },
        ])

        expect(createItemMock).toHaveBeenCalledOnce()
        expect(createItemMock).toHaveBeenCalledWith([], 1, MODEL, service)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            { val: 1, char: 'a' },
            { val: 999, char: 'zzz' },
            { val: 2, char: 'b' },
          ],
          [
            { val: '', char: '' },
            { val: '', char: '' },
            { val: '', char: '' },
          ],
          [
            { val: true, char: true },
            { val: true, char: true },
            { val: true, char: true },
          ],
        ])
      })
    })
  })

  describe('removeItem()', () => {
    describe('object model', () => {
      const MODEL = {
        items: [1, 2, 3],
      }

      test('when removing an item from the end of an array', () => {
        const service = new FormService(MODEL, {}, onChangeMock)

        service.removeItem('items')

        expect(service.state).toStrictEqual({
          items: [1, 2],
        })
      })

      test('when removing an item from the middle of an array', () => {
        const service = new FormService(MODEL, {}, onChangeMock)

        service.removeItem('items', 1)

        expect(service.state).toStrictEqual({
          items: [1, 3],
        })
      })

      test('when removing an item from the front of an array', () => {
        const service = new FormService(MODEL, {}, onChangeMock)

        service.removeItem('items', 0)

        expect(service.state).toStrictEqual({
          items: [2, 3],
        })
      })
    })

    describe('array model', () => {
      const MODEL = [1, 2, 3]

      test('when removing an item from the end of an array', () => {
        const service = new FormService(MODEL, {}, onChangeMock)

        service.removeItem('')

        expect(service.state).toStrictEqual([1, 2])
      })

      test('when removing an item from the middle of an array', () => {
        const service = new FormService(MODEL, {}, onChangeMock)

        service.removeItem('', 1)

        expect(service.state).toStrictEqual([1, 3])
      })

      test('when removing an item from the front of an array', () => {
        const service = new FormService(MODEL, {}, onChangeMock)

        service.removeItem('', 0)

        expect(service.state).toStrictEqual([2, 3])
      })
    })
  })

  describe('moveItem()', () => {
    describe('object model', () => {
      test('when invoked (simple)', () => {
        const MODEL = {
          items: [1, 2, 3],
        }

        const SELECTORS = {
          children: {
            items: {
              children: {
                $: [failValidator],
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('items.2', 999)
        service.apply('items.2', 999)
        service.moveItem('items', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          { items: [999, 1, 2] },
          { items: ['asdf', '', ''] },
          { items: [false, true, true] },
        ])
      })

      test('when invoked (complex)', () => {
        const MODEL = {
          items: [
            { id: 1 },
            { id: 2 },
            { id: 3 },
          ],
        }

        const SELECTORS = {
          children: {
            items: {
              children: {
                $: [failValidator],
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('items.2.id', 999)
        service.apply('items.2.id', 999)
        service.moveItem('items', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              { id: 999 },
              { id: 1 },
              { id: 2 },
            ],
          },
          { items: ['asdf', '', ''] },
          {
            items: [
              { id: false },
              { id: true },
              { id: true },
            ],
          },
        ])
      })
    })

    describe('array model', () => {
      test('when invoked (simple)', () => {
        const MODEL = [1, 2, 3]

        const SELECTORS = {
          children: {
            $: [failValidator],
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('2', 999)
        service.apply('2', 999)
        service.moveItem('', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          [999, 1, 2],
          ['asdf', '', ''],
          [false, true, true],
        ])
      })

      test('when invoked (complex)', () => {
        const MODEL = [
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ]

        const SELECTORS = {
          children: {
            $: [failValidator],
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('2.id', 999)
        service.apply('2.id', 999)
        service.moveItem('', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            { id: 999 },
            { id: 1 },
            { id: 2 },
          ],
          ['asdf', '', ''],
          [
            { id: false },
            { id: true },
            { id: true },
          ],
        ])
      })
    })
  })

  describe('swapItem()', () => {
    describe('object model', () => {
      test('when invoked (simple)', () => {
        const MODEL = {
          items: [1, 2, 3],
        }

        const SELECTORS = {
          children: {
            items: {
              children: {
                $: [failValidator],
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('items.2', 999)
        service.apply('items.2', 999)
        service.swapItems('items', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          { items: [999, 2, 1] },
          { items: ['asdf', '', ''] },
          { items: [false, true, false] },
        ])
      })

      test('when invoked (complex)', () => {
        const MODEL = {
          items: [
            { id: 1 },
            { id: 2 },
            { id: 3 },
          ],
        }

        const SELECTORS = {
          children: {
            items: {
              children: {
                $: [failValidator],
              },
            },
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('items.2.id', 999)
        service.apply('items.2.id', 999)
        service.swapItems('items', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          {
            items: [
              { id: 999 },
              { id: 2 },
              { id: 1 },
            ],
          },
          { items: ['asdf', '', ''] },
          {
            items: [
              false, // BUG: FIX THIS!
              { id: true },
              false, // BUG: FIX THIS!
            ],
          },
        ])
      })
    })

    describe('array model', () => {
      test('when invoked (simple)', () => {
        const MODEL = [1, 2, 3]

        const SELECTORS = {
          children: {
            $: [failValidator],
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('2', 999)
        service.apply('2', 999)
        service.swapItems('', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          [999, 2, 1],
          ['asdf', '', ''],
          [false, true, false],
        ])
      })

      test('when invoked (complex)', () => {
        const MODEL = [
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ]

        const SELECTORS = {
          children: {
            $: [failValidator],
          },
        }

        const service = new FormService(MODEL, SELECTORS, onChangeMock)

        service.apply('2.id', 999)
        service.apply('2.id', 999)
        service.swapItems('', 2, 0)

        expect(getLastChange()).toStrictEqual([
          true,
          [
            { id: 999 },
            { id: 2 },
            { id: 1 },
          ],
          ['asdf', '', ''],
          [
            false, // BUG: FIX THIS!
            { id: true },
            false, // BUG: FIX THIS!
          ],
        ])
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

    describe('when clipPristine is set on a key with children', () => {
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

        service = new FormService(MODEL, SELECTORS, onChangeMock)
        validatorStub = spyOn(service, 'validateKey')
        valid = service.validate()
      })

      it('only calls validator once', () => expect(validatorStub).toHaveBeenCalledTimes(1))
    })

    describe('when invalid data is provided', () => {
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

        service = new FormService(MODEL, SELECTORS, onChangeMock)
        valid = service.validate()
      })

      it('fails', () => expect(valid).toBe(false))

      it('is flagged with errors', () => expect(service.hasErrors).toBe(true))

      it('removes pristine status from all fields', () =>
        expect(service.__pristine).toEqual({
          name: false,
          description: false,
          amount: false,
        }))

      it('invokes callback', () => expect(getLastChange()).toEqual([
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

    describe('when valid data is provided', () => {
      const MODEL = { name: 'asdf' }

      const SELECTORS = {
        children: {
          name: [isRequired()],
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        valid = service.validate()
      })

      it('passes', () => expect(valid).toBe(true))

      it('invokes callback', () => expect(getLastChange()).toEqual([
        false,
        { name: 'asdf' },
        { name: '' },
        { name: false },
      ]))
    })

    describe('when invalid data is provided (multiple validators)', () => {
      const MODEL = { name: 'Wronguy' }

      const SELECTORS = {
        children: {
          name: [isRequired(), VALIDATOR_NAME_MATCH],
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        valid = service.validate()
      })

      it('fails', () => expect(valid).toBe(false))

      it('invokes callback', () => expect(getLastChange()).toEqual([
        false,
        { name: 'Wronguy' },
        { name: 'Invalid' },
        { name: false },
      ]))

      describe('when failing on the first validator', () => {
        beforeEach(() => {
          service.apply('name', '')
          valid = service.validate()
        })

        it('invokes callback with an error for the first failure', () =>
          expect(getLastChange()).toEqual([
            true,
            { name: '' },
            { name: 'Required' },
            { name: false },
          ])
        )
      })
    })

    describe('when validating across multiple levels of selectors', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        valid = service.validate()
      })

      it('passes', () => expect(valid).toBe(true))

      it('invokes callback', () => expect(getLastChange()).toEqual([
        false,
        MODEL,
        { tax: { name: '', rate: '' } },
        { tax: { name: false, rate: false } },
      ]))

      describe('when setting a name', () => {
        beforeEach(() => {
          service.apply('tax.name', 'asdf')
          valid = service.validate()
        })

        it('fails', () => expect(valid).toBe(false))

        it('invokes callback', () => expect(getLastChange()).toEqual([
          true,
          { tax: { name: 'asdf', rate: '' } },
          { tax: { name: '', rate: 'Required' } },
          { tax: { name: false, rate: false } },
        ]))

        describe('when providing an INVALID rate', () => {
          beforeEach(() => {
            service.apply('tax.rate', '-10')
            valid = service.validate()
          })

          it('fails', () => expect(valid).toBe(false))

          it('invokes callback', () => expect(getLastChange()).toEqual([
            true,
            { tax: { name: 'asdf', rate: '-10' } },
            { tax: { name: '', rate: '0 - 100' } },
            { tax: { name: false, rate: false } },
          ]))

          describe('when providing a VALID rate', () => {
            beforeEach(() => {
              service.apply('tax.rate', '10')
              valid = service.validate()
            })

            it('passes', () => expect(valid).toBe(true))

            it('invokes callback', () => expect(getLastChange()).toEqual([
              true,
              { tax: { name: 'asdf', rate: '10' } },
              { tax: { name: '', rate: '' } },
              { tax: { name: false, rate: false } },
            ]))
          })
        })

        describe('when clearing the name', () => {
          beforeEach(() => {
            service.apply('tax.name', '')
            valid = service.validate()
          })

          it('passes again', () => expect(valid).toBe(true))

          it('invokes callback', () => expect(getLastChange()).toEqual([
            false,
            { tax: { name: '', rate: '' } },
            { tax: { name: '', rate: '' } },
            { tax: { name: false, rate: false } },
          ]))
        })
      })
    })

    describe('when errors are clipped', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        valid = service.validate()
      })

      it('is invalid', () => expect(valid).toBe(false))

      describe('when validating a second time', () => {
        beforeEach(() => {
          valid = service.validate()
        })

        it('is still invalid', () => expect(valid).toBe(false))
      })
    })

    describe('when validating an array', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        valid = service.validate()
      })

      it('is valid', () => expect(valid).toBe(true))

      it('invokes callback', () => expect(getLastChange()).toEqual([
        false,
        MODEL,
        ERRORS,
        PRISTINE,
      ]))

      describe('when errors are present', () => {
        beforeEach(() => {
          service.apply('phones.0.type', 'Home')
          service.apply('phones.1.number', '7025551234')

          valid = service.validate()
        })

        it('is NOT valid', () => expect(valid).toBe(false))

        it('has errors', () =>
          expect(service.__errors).toEqual({
            phones: [
              { type: '', number: '' },
              { type: 'Required', number: '' },
            ],
          }))
      })
    })

    describe('when ignoring pristine status of a key', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.apply('rate', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).toEqual({ rate: '0 - 100' }))
    })

    describe('when ignoring pristine status of a key (array)', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.apply('rates.0', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).toEqual({ rates: ['0 - 100'] }))

      describe('when adding an item to the array', () => {
        beforeEach(() => {
          service.addItem('rates')
          service.apply('rates.1', 101)
        })

        it('immediately errors', () =>
          expect(service.__errors).toEqual({ rates: ['0 - 100', '0 - 100'] }))
      })
    })

    describe('when ignoring pristine status of a key (array-child)', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.apply('taxes.0.rate', 101)
      })

      it('immediately errors', () =>
        expect(service.__errors).toEqual({
          taxes: [{ name: '', rate: '0 - 100' }],
        }))

      describe('when adding an item to the array', () => {
        beforeEach(() => {
          service.addItem('taxes')
          service.apply('taxes.1.rate', 101)
        })

        it('immediately errors', () =>
          expect(service.__errors).toEqual({
            taxes: [
              { name: '', rate: '0 - 100' },
              { name: '', rate: '0 - 100' },
            ],
          }))
      })
    })

    describe('when model is an array', () => {
      const SELECTORS = {
        createItem: () => ({ id: '', name: '' }),
        validators: [{
          error: 'Invalid',
          validate: v => v[0].name === 'asdf',
        }],
      }

      let valid

      beforeEach(() => {
        service = new FormService(ITEMS_MODEL, SELECTORS, onChangeMock)
        service.apply('0.name', 'asdf')
        valid = service.validate()
      })

      it('passes validation', () => expect(valid).toBe(true))

      describe('when validation fails', () => {
        beforeEach(() => {
          service.apply('0.name', '')
          valid = service.validate()
        })

        it('fails', () => expect(valid).toBe(false))
      })
    })

    describe('when selector validates against unformatted value', () => {
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
        validator.validate = mock(() => true)

        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.validate()
      })

      it('unformats the value', () =>
        expect(validator.validate.mock.calls).toEqual([
          [AMOUNT_RAW, ['amount'], MODEL, service],
        ]))
    })

    describe('when manually validating a key', () => {
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
        validator.validate = mock(() => true)

        service = new FormService(MODEL, SELECTORS, onChangeMock)
      })

      it('does not invoke the validator', () =>
        expect(validator.validate).not.toHaveBeenCalled())

      describe('when manually validating', () => {
        beforeEach(() => {
          service.validate()
        })

        it('invokes the validator', () =>
          expect(validator.validate).toHaveBeenCalledTimes(1))
      })
    })
  })

  describe('unsetPristine()', () => {
    describe('primitive model', () => {
      const MODEL = ''
      const SELECTORS = { children: {} }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when unsetting the root selector', () => {
        const service = createService()
        const fn = () => service.unsetPristine([''])

        expect(fn).toThrow(new TypeError('Invalid path: \'\''))
      })
    })

    describe('object model', () => {
      const MODEL = {
        name: '',
        stats: {
          hp: 8,
        },
        items: [
          {
            id: 1,
            amount: 2,
          },
        ],
        refs: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      }

      const SELECTORS = {
        children: {
          name: { format: v => v },
          stats: {
            children: {
              hp: { format: v => v },
            },
          },
          items: {
            children: {
              $: {
                children: {
                  id: { format: v => v },
                  amount: { format: v => v },
                },
              },
            },
          },
          refs: {
            children: {
              $: {
                children: {
                  $: { format: v => v },
                },
              },
            },
          },
        },
      }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when root-level property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['asdf'])

        expect(fn).toThrow(new TypeError('Invalid path: \'asdf\''))
      })

      test('when root-level property selector EXISTS', () => {
        const service = createService()

        service.unsetPristine(['name'])

        expect(service.pristine.name).toBe(false)
      })

      test('when sub-object property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['stats', 'asdf'])

        expect(fn).toThrow(new TypeError('Invalid path: \'stats.asdf\''))
      })

      test('when sub-object property selector EXISTS', () => {
        const service = createService()

        service.unsetPristine(['stats', 'hp'])

        expect(service.pristine.stats.hp).toBe(false)
      })

      test('when array-object index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['items', '999', 'amount'])

        expect(fn).toThrow(new TypeError('Invalid path: \'items.999.amount\''))
      })

      test('when array-object property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['items', '0', 'asdf'])

        expect(fn).toThrow(new TypeError('Invalid path: \'items.0.asdf\''))
      })

      test('when array-object property selector EXISTS', () => {
        const service = createService()

        service.unsetPristine(['items', '0', 'amount'])

        expect(service.pristine.items[0].amount).toBe(false)
      })

      test('when 1st nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['refs', '999', '0'])

        expect(fn).toThrow(new TypeError('Invalid path: \'refs.999.0\''))
      })

      test('when 2nd nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['refs', '0', '999'])

        expect(fn).toThrow(new TypeError('Invalid path: \'refs.0.999\''))
      })

      test('when nested-array property selector EXISTS', () => {
        const service = createService()

        service.unsetPristine(['refs', '0', '0'])

        expect(service.pristine.refs[0][0]).toBe(false)
      })

      test('when selecting an object property', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['stats'])

        expect(fn).toThrow(new TypeError('Invalid path: \'stats\''))
      })

      test('when selecting an array property', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['items'])

        expect(fn).toThrow(new TypeError('Invalid path: \'items\''))
      })

      test('when selecting a nested-array property', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['refs', '0'])

        expect(fn).toThrow(new TypeError('Invalid path: \'refs.0\''))
      })
    })

    describe('array model', () => {
      const MODEL = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]

      const SELECTORS = {
        children: {
          $: {
            children: {
              $: { format: v => v },
            },
          },
        },
      }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when 1st nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['999', '0'])

        expect(fn).toThrow(new TypeError('Invalid path: \'999.0\''))
      })

      test('when 2nd nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['0', '999'])

        expect(fn).toThrow(new TypeError('Invalid path: \'0.999\''))
      })

      test('when nested-array property selector EXISTS', () => {
        const service = createService()

        service.unsetPristine(['0', '0'])

        expect(service.pristine[0][0]).toBe(false)
      })

      test('when selecting an array property', () => {
        const service = createService()
        const fn = () => service.unsetPristine(['0'])

        expect(fn).toThrow(new TypeError('Invalid path: \'0\''))
      })

      test('when selecting a nested-array property', () => {
        const service = createService()

        service.unsetPristine(['0', '0'])

        expect(service.pristine[0][0]).toBe(false)
      })
    })
  })

  describe('getSelectorPath()', () => {
    test('when resolving the path for root', () => {
      const MODEL = {
        name: '',
      }

      const SELECTORS = {
        children: {
          name: { format: v => v },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      const result = service.getSelectorPath([])

      expect(result).toStrictEqual([])
    })

    describe('primitive model', () => {
      const MODEL = ''
      const SELECTORS = { children: {} }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when selecting the root selector', () => {
        const service = createService()
        const fn = () => service.getSelectorPath([''])

        expect(fn).toThrow(new PathError(['']))
      })
    })

    describe('object model', () => {
      const MODEL = {
        name: '',
        stats: {
          hp: 8,
        },
        items: [
          {
            id: 1,
            amount: 2,
          },
        ],
        refs: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      }

      const SELECTORS = {
        children: {
          name: { format: v => v },
          stats: {
            children: {
              hp: { format: v => v },
            },
          },
          items: {
            children: {
              $: {
                children: {
                  id: { format: v => v },
                  amount: { format: v => v },
                },
              },
            },
          },
          refs: {
            children: {
              $: {
                children: {
                  $: { format: v => v },
                },
              },
            },
          },
        },
      }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when root-level property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['asdf'])

        expect(fn).toThrow(new PathError(['asdf']))
      })

      test('when root-level property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelectorPath(['name'])

        expect(result).toStrictEqual(['children', 'name'])
      })

      test('when sub-object property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['stats', 'asdf'])

        expect(fn).toThrow(new PathError(['stats', 'asdf']))
      })

      test('when sub-object property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelectorPath(['stats', 'hp'])

        expect(result).toStrictEqual([
          'children',
          'stats',
          'children',
          'hp',
        ])
      })

      test('when array-object index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['items', '999', 'amount'])

        expect(fn).toThrow(new PathError(['items', '999', 'amount']))
      })

      test('when array-object property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['items', '0', 'asdf'])

        expect(fn).toThrow(new PathError(['items', '0', 'asdf']))
      })

      test('when array-object property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelectorPath(['items', '0', 'amount'])

        expect(result).toStrictEqual([
          'children',
          'items',
          'children',
          '$',
          'children',
          'amount',
        ])
      })

      test('when 1st nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['refs', '999', '0'])

        expect(fn).toThrow(new PathError(['refs', '999', '0']))
      })

      test('when 2nd nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['refs', '0', '999'])

        expect(fn).toThrow(new PathError(['refs', '0', '999']))
      })

      test('when nested-array property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelectorPath(['refs', '0', '0'])

        expect(result).toStrictEqual([
          'children',
          'refs',
          'children',
          '$',
          'children',
          '$',
        ])
      })

      test('when selecting an object property', () => {
        const service = createService()
        const result = service.getSelectorPath(['stats'])

        expect(result).toStrictEqual(['children', 'stats'])
      })

      test('when selecting an array property', () => {
        const service = createService()
        const result = service.getSelectorPath(['items'])

        expect(result).toStrictEqual(['children', 'items'])
      })

      test('when selecting a nested-array property', () => {
        const service = createService()
        const result = service.getSelectorPath(['refs', '0'])

        expect(result).toStrictEqual(['children', 'refs', 'children', '$'])
      })
    })

    describe('array model', () => {
      const MODEL = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]

      const SELECTORS = {
        children: {
          $: {
            children: {
              $: { format: v => v },
            },
          },
        },
      }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when 1st nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['999', '0'])

        expect(fn).toThrow(new PathError(['999', '0']))
      })

      test('when 2nd nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelectorPath(['0', '999'])

        expect(fn).toThrow(new PathError(['0', '999']))
      })

      test('when nested-array property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelectorPath(['0', '0'])

        expect(result).toStrictEqual([
          'children',
          '$',
          'children',
          '$',
        ])
      })

      test('when selecting an array property', () => {
        const service = createService()
        const result = service.getSelectorPath(['0'])

        expect(result).toStrictEqual(['children', '$'])
      })

      test('when selecting a nested-array property', () => {
        const service = createService()
        const result = service.getSelectorPath(['0', '0'])

        expect(result).toStrictEqual(['children', '$', 'children', '$'])
      })
    })
  })

  describe('getSelector()', () => {
    test('when getting the root selector', () => {
      const MODEL = {
        name: '',
      }

      const SELECTORS = {
        children: {
          name: { format: v => v },
        },
      }

      const service = new FormService(MODEL, SELECTORS, onChangeMock)

      const result = service.getSelector([])

      expect(result).toStrictEqual(SELECTORS)
    })

    describe('primitive model', () => {
      const MODEL = ''
      const SELECTORS = { children: {} }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when selecting the root selector', () => {
        const service = createService()
        const fn = () => service.getSelector([''])

        expect(fn).toThrow(new PathError(['']))
      })
    })

    describe('object model', () => {
      const MODEL = {
        name: '',
        stats: {
          hp: 8,
        },
        items: [
          {
            id: 1,
            amount: 2,
          },
        ],
        refs: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      }

      const SELECTORS = {
        children: {
          name: { format: v => v },
          stats: {
            children: {
              hp: { format: v => v },
            },
          },
          items: {
            children: {
              $: {
                children: {
                  id: { format: v => v },
                  amount: { format: v => v },
                },
              },
            },
          },
          refs: {
            children: {
              $: {
                children: {
                  $: { format: v => v },
                },
              },
            },
          },
        },
      }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when root-level property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['asdf'])

        expect(fn).toThrow(new PathError(['asdf']))
      })

      test('when root-level property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelector(['name'])

        expect(result).toStrictEqual(SELECTORS.children.name)
      })

      test('when sub-object property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['stats', 'asdf'])

        expect(fn).toThrow(new PathError(['stats', 'asdf']))
      })

      test('when sub-object property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelector(['stats', 'hp'])

        expect(result).toStrictEqual(SELECTORS.children.stats.children.hp)
      })

      test('when array-object index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['items', '999', 'amount'])

        expect(fn).toThrow(new PathError(['items', '999', 'amount']))
      })

      test('when array-object property selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['items', '0', 'asdf'])

        expect(fn).toThrow(new PathError(['items', '0', 'asdf']))
      })

      test('when array-object property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelector(['items', '0', 'amount'])

        expect(result).toStrictEqual(
          SELECTORS
            .children
            .items
            .children
            .$
            .children
            .amount
        )
      })

      test('when 1st nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['refs', '999', '0'])

        expect(fn).toThrow(new PathError(['refs', '999', '0']))
      })

      test('when 2nd nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['refs', '0', '999'])

        expect(fn).toThrow(new PathError(['refs', '0', '999']))
      })

      test('when nested-array property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelector(['refs', '0', '0'])

        expect(result).toStrictEqual(
          SELECTORS
            .children
            .refs
            .children
            .$
            .children
            .$,
        )
      })

      test('when selecting an object property', () => {
        const service = createService()
        const result = service.getSelector(['stats'])

        expect(result).toStrictEqual(SELECTORS.children.stats)
      })

      test('when selecting an array property', () => {
        const service = createService()
        const result = service.getSelector(['items'])

        expect(result).toStrictEqual(SELECTORS.children.items)
      })

      test('when selecting a nested-array property', () => {
        const service = createService()
        const result = service.getSelector(['refs', '0'])

        expect(result).toStrictEqual(SELECTORS.children.refs.children.$)
      })
    })

    describe('array model', () => {
      const MODEL = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]

      const SELECTORS = {
        children: {
          $: {
            children: {
              $: { format: v => v },
            },
          },
        },
      }

      function createService () {
        return new FormService(MODEL, SELECTORS, onChangeMock)
      }

      test('when 1st nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['999', '0'])

        expect(fn).toThrow(new PathError(['999', '0']))
      })

      test('when 2nd nested-array index selector DOES NOT exist', () => {
        const service = createService()
        const fn = () => service.getSelector(['0', '999'])

        expect(fn).toThrow(new PathError(['0', '999']))
      })

      test('when nested-array property selector EXISTS', () => {
        const service = createService()
        const result = service.getSelector(['0', '0'])

        expect(result).toStrictEqual(SELECTORS.children.$.children.$)
      })

      test('when selecting an array property', () => {
        const service = createService()
        const result = service.getSelector(['0'])

        expect(result).toStrictEqual(SELECTORS.children.$)
      })

      test('when selecting a nested-array property', () => {
        const service = createService()
        const result = service.getSelector(['0', '0'])

        expect(result).toStrictEqual(SELECTORS.children.$.children.$)
      })
    })
  })
})
