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

      expect(service.state).toEqual({ amount: '$0.42' })
      expect(model).toEqual({ amount: 42 })
    })
  })

  // TODO: add formatters, and verify pristine
  describe('clipPristine', () => {
    describe('when clipping an object', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).toEqual(EXPECTED_RESULT))
    })

    describe('when clipping an array', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).toEqual(EXPECTED_RESULT))
    })

    describe('when clipping an array\'s object-elements', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
      })

      it('returns the proper schema', () =>
        expect(service.__pristine).toEqual(EXPECTED_RESULT))

      describe('when adding an item', () => {
        const RESULT_ADDED = {
          ...EXPECTED_RESULT,
          types: [true, true],
        }

        beforeEach(() => {
          service.addItem('types')
        })

        it('clips the schema on the new item', () =>
          expect(service.__pristine).toEqual(RESULT_ADDED))
      })
    })
  })

  describe('getSelectorPath()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, ENEMY_SELECTORS, onChangeMock)
    })

    it('throws an error when an invalid path is provided: "asdf"', () =>
      expect(() => service.getSelectorPath(['asdf'])).toThrow(PathError))

    it('resovle the path for root', () =>
      expect(service.getSelectorPath([])).toEqual([]))

    it('resolve the path for "name"', () =>
      expect(service.getSelectorPath(['name'])).toEqual(['children', 'name']))

    it('resolve the path for "job"', () =>
      expect(service.getSelectorPath(['job'])).toEqual(['children', 'job']))

    it('resolve the path for "stats"', () =>
      expect(service.getSelectorPath(['stats'])).toEqual(['children', 'stats']))

    it('resolve the path for "stats.attack"', () =>
      expect(service.getSelectorPath(['stats', 'attack'])).toEqual([
        'children', 'stats', 'children', 'attack',
      ]))

    it('resolve the path for "stats.evasion"', () =>
      expect(service.getSelectorPath(['stats', 'evasion'])).toEqual([
        'children', 'stats', 'children', 'evasion',
      ]))

    it('resolve the path for "stats.speed"', () =>
      expect(service.getSelectorPath(['stats', 'speed'])).toEqual([
        'children', 'stats', 'children', 'speed',
      ]))

    it('resolve the path for "stats.attributes"', () =>
      expect(service.getSelectorPath(['stats', 'attributes'])).toEqual([
        'children', 'stats', 'children', 'attributes',
      ]))

    it('resolve the path for "stats.attributes.level"', () =>
      expect(service.getSelectorPath(['stats', 'attributes', 'level'])).toEqual([
        'children', 'stats', 'children', 'attributes', 'children', 'level',
      ]))

    it('resolve the path for "stats.attributes.experience"', () =>
      expect(service.getSelectorPath(['stats', 'attributes', 'experience'])).toEqual([
        'children', 'stats', 'children', 'attributes', 'children', 'experience',
      ]))

    it('resolve the path for "stats.ailments"', () =>
      expect(service.getSelectorPath(['ailments'])).toEqual(['children', 'ailments']))

    it('resolve the path for "ailments.0"', () =>
      expect(service.getSelectorPath(['ailments', '0'])).toEqual([
        'children', 'ailments', 'children', '$',
      ]))

    it('resolve the path for "items"', () =>
      expect(service.getSelectorPath(['items'])).toEqual(['children', 'items']))

    it('resolve the path for "items.0"', () =>
      expect(service.getSelectorPath(['items', '0'])).toEqual([
        'children', 'items', 'children', '$',
      ]))

    it('resolve the path for "items.0.id"', () =>
      expect(service.getSelectorPath(['items', '0', 'id'])).toEqual([
        'children', 'items', 'children', '$', 'children', 'id',
      ]))

    it('resolve the path for "items.0.rate"', () =>
      expect(service.getSelectorPath(['items', '0', 'rate'])).toEqual([
        'children', 'items', 'children', '$', 'children', 'rate',
      ]))

    it('resolve the path for "triangles"', () =>
      expect(service.getSelectorPath(['triangles'])).toEqual(['children', 'triangles']))

    it('resolve the path for "triangles.0"', () =>
      expect(service.getSelectorPath(['triangles', '0'])).toEqual([
        'children', 'triangles', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.0"', () =>
      expect(service.getSelectorPath(['triangles', '0', '0'])).toEqual([
        'children', 'triangles', 'children', '$', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.1"', () =>
      expect(service.getSelectorPath(['triangles', '0', '1'])).toEqual([
        'children', 'triangles', 'children', '$', 'children', '$',
      ]))

    it('resolve the path for "triangles.0.2"', () =>
      expect(service.getSelectorPath(['triangles', '0', '2'])).toEqual([
        'children', 'triangles', 'children', '$', 'children', '$',
      ]))

    it('throws an error when an invalid path is provided: "triangles.0.3"', () =>
      expect(() => service.getSelectorPath(['triangles.0.3'])).toThrow(PathError))

    describe('array model', () => {
      beforeEach(() => {
        service = new FormService(ITEMS_MODEL, ITEMS_SELECTORS, onChangeMock)
      })

      it('resolve the path for root', () =>
        expect(service.getSelectorPath([])).toEqual([]))

      it('resolve the path for "0"', () =>
        expect(service.getSelectorPath(['0'])).toEqual(['children', '$']))

      it('resolve the path for "0.id"', () =>
        expect(service.getSelectorPath(['0', 'id'])).toEqual([
          'children', '$', 'children', 'id',
        ]))

      it('resolve the path for "0.name"', () =>
        expect(service.getSelectorPath(['0', 'name'])).toEqual([
          'children', '$', 'children', 'name',
        ]))
    })
  })

  describe('getSelector()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, ENEMY_SELECTORS, onChangeMock)
    })

    it('throws an error when an invalid path is provided: "asdf"', () =>
      expect(() => service.getSelector(['asdf'])).toThrow(PathError))

    it('finds the selector for root', () =>
      expect(service.getSelector([])).toBe(ENEMY_SELECTORS))

    it('finds the selector for "name"', () =>
      expect(service.getSelector(['name'])).toBe(
        ENEMY_SELECTORS.children.name,
      ))

    it('does not find a selector for "job"', () =>
      expect(service.getSelector(['job'])).toBe(undefined))

    it('finds a selector for "stats"', () =>
      expect(service.getSelector(['stats'])).toBe(
        ENEMY_SELECTORS.children.stats,
      ))

    it('finds a selector for "stats.attack"', () =>
      expect(service.getSelector(['stats', 'attack'])).toBe(
        ENEMY_SELECTORS.children.stats.children.attack,
      ))

    it('finds a selector for "stats.evasion"', () =>
      expect(service.getSelector(['stats', 'evasion'])).toBe(
        ENEMY_SELECTORS.children.stats.children.evasion,
      ))

    it('finds a selector for "stats.speed"', () =>
      expect(service.getSelector(['stats', 'speed'])).toBe(
        ENEMY_SELECTORS.children.stats.children.speed,
      ))

    it('finds a selector for "stats.attributes"', () =>
      expect(service.getSelector(['stats', 'attributes'])).toBe(
        ENEMY_SELECTORS.children.stats.children.attributes,
      ))

    it('finds a selector for "stats.attributes.level"', () =>
      expect(service.getSelector(['stats', 'attributes', 'level'])).toBe(
        ENEMY_SELECTORS.children.stats.children.attributes.children.level,
      ))

    it('finds a selector for "stats.attributes.experience"', () =>
      expect(service.getSelector(['stats', 'attributes', 'experience'])).toBe(
        ENEMY_SELECTORS.children.stats.children.attributes.children.experience,
      ))

    it('finds a selector for "stats.ailments"', () =>
      expect(service.getSelector(['ailments'])).toBe(
        ENEMY_SELECTORS.children.ailments,
      ))

    it('finds a selector for "ailments.0"', () =>
      expect(service.getSelector(['ailments', '0'])).toBe(
        ENEMY_SELECTORS.children.ailments.children.$,
      ))

    it('finds a selector for "items"', () =>
      expect(service.getSelector(['items'])).toBe(
        ENEMY_SELECTORS.children.items,
      ))

    it('finds a selector for "items.0"', () =>
      expect(service.getSelector(['items', '0'])).toBe(
        ENEMY_SELECTORS.children.items.children.$,
      ))

    it('finds a selector for "items.0.id"', () =>
      expect(service.getSelector(['items', '0', 'id'])).toBe(
        ENEMY_SELECTORS.children.items.children.$.children.id,
      ))

    it('finds a selector for "items.0.rate"', () =>
      expect(service.getSelector(['items', '0', 'rate'])).toBe(
        ENEMY_SELECTORS.children.items.children.$.children.rate,
      ))

    it('finds a selector for "triangles"', () =>
      expect(service.getSelector(['triangles'])).toBe(
        ENEMY_SELECTORS.children.triangles,
      ))

    it('finds a selector for "triangles.0"', () =>
      expect(service.getSelector(['triangles', '0'])).toBe(
        ENEMY_SELECTORS.children.triangles.children.$,
      ))

    it('finds a selector for "triangles.0.0"', () =>
      expect(service.getSelector(['triangles', '0', '0'])).toBe(
        ENEMY_SELECTORS.children.triangles.children.$.children.$,
      ))

    it('finds a selector for "triangles.0.1"', () =>
      expect(service.getSelector(['triangles', '0', '1'])).toBe(
        ENEMY_SELECTORS.children.triangles.children.$.children.$,
      ))

    it('finds a selector for "triangles.0.2"', () =>
      expect(service.getSelector(['triangles', '0', '2'])).toBe(
        ENEMY_SELECTORS.children.triangles.children.$.children.$,
      ))

    it('throws an error when an invalid path is provided: "triangles.0.3"', () =>
      expect(() => service.getSelector(['triangles', '0', '3'])).toThrow(PathError))

    describe('array model', () => {
      beforeEach(() => {
        service = new FormService(ITEMS_MODEL, ITEMS_SELECTORS, onChangeMock)
      })

      it('finds a selector for root', () =>
        expect(service.getSelector([])).toEqual(ITEMS_SELECTORS))

      it('finds a selector for "0"', () =>
        expect(service.getSelector(['0'])).toEqual(ITEMS_SELECTORS.children.$))

      it('finds a selector for "0.id"', () =>
        expect(service.getSelector(['0', 'id'])).toEqual(
          ITEMS_SELECTORS.children.$.children.id,
        ))

      it('finds a selector for "0.name"', () =>
        expect(service.getSelector(['0', 'name'])).toEqual(
          ITEMS_SELECTORS.children.$.children.name,
        ))
    })
  })

  describe('unsetPristine()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeMock)
    })

    describe('when unsetting a top-level key', () => {
      beforeEach(() => {
        service.unsetPristine(['name'])
      })

      it('unsets the flag', () => expect(getLastChange()[3]).toEqual({
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

    describe('when unsetting a nested key', () => {
      beforeEach(() => {
        service.unsetPristine(['stats', 'attack'])
      })

      it('unsets the flag', () => expect(getLastChange()[3]).toEqual({
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

    describe('when unsetting on an invalid path', () => {
      const INVALID_PATH = ['stats', 'attack', '0']
      const fn = () => service.unsetPristine(INVALID_PATH)

      it('throws an error', () =>
        expect(fn).toThrow(`Invalid path: ${INVALID_PATH.join('.')}`))
    })

    describe('when setting on a branch instead of a leaf', () => {
      const INVALID_PATH = ['stats']
      const fn = () => service.unsetPristine(INVALID_PATH)

      it('throws an error', () =>
        expect(fn).toThrow(`Invalid path: ${INVALID_PATH.join('.')}`))
    })
  })

  describe('apply()', () => {
    beforeEach(() => {
      service = new FormService(ENEMY_MODEL, {}, onChangeMock)
    })

    it('invokes onChange', () =>
      expect(getLastChange()).toEqual([
        false, ENEMY_MODEL, ENEMY_ERRORS, ENEMY_PRISTINE,
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

    describe.skip('when adding a rogue property to sub-object', () => {
      const fn = () => service.apply('stats.asdf', 42)

      it('throws an error', () => expect(fn).toThrow(MutationError))
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
          expect(getLastChange()).toEqual([
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

    describe('when an object is added', () => {
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
        spy = spyOn(SELECTORS.children.items, 'createItem')

        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
        result = service.build().items
      })

      it('invokes createItem() with the correct arguments', () =>
        expect(spy).toHaveBeenCalledWith(['items'], 5, MODEL, service))

      it('adds the next Fibonacci number in the sequence', () =>
        expect(result).toEqual([1, 2, 3, 5, 8, 13]))
    })

    describe('when adding a primitive item', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => '',
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).toEqual({ items: [''] }))

      describe('when adding an item to end of an array', () => {
        const EXPECTED = ['', '']

        beforeEach(() => {
          service.addItem('items')
        })

        it('adds it', () => expect(service.__state.items).toEqual(EXPECTED))

        describe('when adding an item in the middle of an array', () => {
          const EXPECTED = ['1', '', '2']

          beforeEach(() => {
            service.apply('items.0', '1')
            service.apply('items.1', '2')
            service.addItem('items', 1)
          })

          it('adds it', () => expect(service.__state.items).toEqual(EXPECTED))
        })
      })
    })

    describe('when adding an object', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({ id: '' }),
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(getLastChange()).toEqual([
          true,
          { items: [{ id: '' }] },
          { items: [{ id: '' }] },
          { items: [{ id: true }] },
        ]))
    })

    describe('when adding an object with validators on the array selector', () => {
      const SELECTORS = {
        children: {
          items: {
            createItem: () => ({ id: '' }),
            validators: [],
          },
        },
      }

      beforeEach(() => {
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(getLastChange()).toEqual([
          true,
          { items: [{ id: '' }] },
          { items: '' },
          { items: [{ id: true }] },
        ]))
    })

    describe('when adding an object with validators on the array element selector', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(getLastChange()).toEqual([
          true,
          { items: [{ id: '' }] },
          { items: [''] },
          { items: [{ id: true }] },
        ]))
    })

    describe('when adding an object with formatter on element', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(service.__state).toEqual({
          items: [{
            id: '',
            name: '',
            amount: '$0.00',
          }],
        }))
    })

    describe('when adding an object with formatter on property of element', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('adds the item', () =>
        expect(service.__state).toEqual({
          items: [{
            id: '',
            name: '',
            amount: '$0.00',
          }],
        }))
    })

    describe('when adding an object item', () => {
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
        service = new FormService(MODEL, SELECTORS, onChangeMock)
        service.addItem('items')
      })

      it('provides the correct errors', () =>
        expect(service.__errors).toEqual({
          items: [
            { start: '', end: '' },
            { start: '', end: '' },
          ],
        }))
    })

    describe('array model', () => {
      describe('when path is empty', () => {
        const MODEL = ['']
        const SELECTORS = {
          createItem: () => '',
        }

        beforeEach(() => {
          service = new FormService(MODEL, SELECTORS, onChangeMock)
          service.addItem('')
        })

        it('adds the item', () =>
          expect(service.__state).toEqual(['', '']))
      })

      describe('when adding an item with validators', () => {
        const SELECTORS = {
          createItem: () => ({ id: '', name: '' }),
          validators: [],
        }

        beforeEach(() => {
          service = new FormService(ITEMS_MODEL, SELECTORS, onChangeMock)
          service.addItem('')
        })

        it('invokes the callback', () =>
          expect(getLastChange()).toEqual([
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
      service = new FormService(ENEMY_MODEL, {}, onChangeMock)
    })

    describe('when removing an item from the end of an array', () => {
      beforeEach(() => {
        service.removeItem('ailments')
      })

      it('removes it', () =>
        expect(service.__state.ailments).toEqual([3, 4]))
    })

    describe('when removing an item from the front of an array', () => {
      beforeEach(() => {
        service.removeItem('ailments', 0)
      })

      it('removes it', () =>
        expect(service.__state.ailments).toEqual([4, 7]))
    })

    describe('array model', () => {
      describe('when path is empty', () => {
        const MODEL = ['']

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeMock)
          service.removeItem('')
        })

        it('removes the item', () =>
          expect(service.__state).toEqual([]))
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
      service = new FormService(ENEMY_MODEL, SELECTORS, onChangeMock)

      service.apply('ailments.2', 7)
      service.apply('ailments.2', 7)
      service.moveItem('ailments', 2, 0)
    })

    it('reorders the item in the state', () =>
      expect(service.__state.ailments).toEqual(EXPECTED_STATE))

    it('reorders the item in the error schema', () =>
      expect(service.__errors.ailments).toEqual(EXPECTED_ERRORS))

    it('reorders the item in the pristine schema', () =>
      expect(service.__pristine.ailments).toEqual(EXPECTED_PRISTINE))

    describe('array model', () => {
      describe('when path is empty', () => {
        const MODEL = ['a', 'b', 'c']

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeMock)
          service.moveItem('', 2, 1)
        })

        it('moves the item', () =>
          expect(service.__state).toEqual(['a', 'c', 'b']))
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
      service = new FormService(ENEMY_MODEL, SELECTORS, onChangeMock)
      service.apply('ailments.2', 7)
      service.apply('ailments.2', 7)
      service.swapItems('ailments', 2, 0)
    })

    it('swaps the selected items in the state', () =>
      expect(service.__state.ailments).toEqual(EXPECTED_STATE))

    it('swaps the selected items in the error schema', () =>
      expect(service.__errors.ailments).toEqual(EXPECTED_ERRORS))

    it('swaps the selected items in the pristine schema', () =>
      expect(service.__pristine.ailments).toEqual(EXPECTED_PRISTINE))

    describe('array model', () => {
      describe('when path is empty', () => {
        const MODEL = ['a', 'b', 'c']

        beforeEach(() => {
          service = new FormService(MODEL, {}, onChangeMock)
          service.swapItems('', 2, 0)
        })

        it('swaps the items', () =>
          expect(service.__state).toEqual(['c', 'b', 'a']))
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
})
