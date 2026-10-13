import { mock, describe, test, expect } from 'bun:test'

import {
  extents,
  padArray,
  filterEmpty,
  moveItem,
  swap,
  traverse,
  map,
  deepEqual,
  deepCopy,
  setValueByPath,
  getValueByPath,
  getKeyPaths,
} from './utils'

const SCHEMA = {
  hasPhoto: false,
  accountNumber: '',
  gender: '',
  ssn: '',
  dateOfBirth: new Date(),
  emails: [''],
  phones: [''],
  address: {
    street1: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
  },
  name: {
    first: '',
    last: '',
    middle: '',
    preferred: '',
  },
  statuses: {
    patient: '',
    employment: '',
    relationship: '',
  },
}

const KEY_PATHS = [
  ['hasPhoto'],
  ['accountNumber'],
  ['gender'],
  ['ssn'],
  ['dateOfBirth'],
  ['emails'],
  ['emails', '0'],
  ['phones'],
  ['phones', '0'],
  ['address'],
  ['address', 'street1'],
  ['address', 'street2'],
  ['address', 'city'],
  ['address', 'state'],
  ['address', 'postalCode'],
  ['name'],
  ['name', 'first'],
  ['name', 'last'],
  ['name', 'middle'],
  ['name', 'preferred'],
  ['statuses'],
  ['statuses', 'patient'],
  ['statuses', 'employment'],
  ['statuses', 'relationship'],
]

describe('extents()', () => {
  test('when params are in ascending order', () => {
    const result = extents(0, 100)

    expect(result).toStrictEqual({
      min: 0,
      max: 100,
    })
  })

  test('when params are in descending order', () => {
    const result = extents(100, 0)

    expect(result).toStrictEqual({
      min: 0,
      max: 100,
    })
  })
})

describe('padArray()', () => {
  test('when called with the array', () => {
    const result = padArray([0], 0)

    expect(result).toStrictEqual([0])
  })

  test('when called with the array', () => {
    const result = padArray([1], 0)

    expect(result).toStrictEqual([1])
  })
})

describe('filterEmpty()', () => {
  test('when called with the array', () => {
    const result = filterEmpty([1])

    expect(result).toStrictEqual([1])
  })

  test('when called with the array', () => {
    const result = filterEmpty([''])

    expect(result).toStrictEqual([])
  })

  test('when the array has an object with no discrete, falsy values', () => {
    const ITEMS = [
      {
        a: 10,
        b: 42,
      },
    ]

    const result = filterEmpty(ITEMS)

    expect(result).toStrictEqual(ITEMS)
  })

  test('when the array has an object with a discrete, falsy value', () => {
    const ITEMS = [
      {
        a: 0,
        b: 42,
      },
    ]

    const result = filterEmpty(ITEMS)

    expect(result).toStrictEqual([])
  })
})

describe('moveItem()', () => {
  const ITEMS = ['a', 'b', 'c', 'd', 'e']

  test('when moving an item up by 1 element', () => {
    const result = moveItem(ITEMS, 3, 2)

    expect(result).toStrictEqual(['a', 'b', 'd', 'c', 'e'])
  })

  test('when moving an item to the front', () => {
    const result = moveItem(ITEMS, 3, 0)

    expect(result).toStrictEqual(['d', 'a', 'b', 'c', 'e'])
  })

  test('when moving an item to the back', () => {
    const result = moveItem(ITEMS, 1, 4)

    expect(result).toStrictEqual(['a', 'c', 'd', 'e', 'b'])
  })

  test('when moving the front item to the back', () => {
    const result = moveItem(ITEMS, 0, 4)

    expect(result).toStrictEqual(['b', 'c', 'd', 'e', 'a'])
  })

  test('when moving the back item to the front', () => {
    const result = moveItem(ITEMS, 4, 0)

    expect(result).toStrictEqual(['e', 'a', 'b', 'c', 'd'])
  })
})

describe('swap()', () => {
  const ITEMS = ['a', 'b', 'c', 'd', 'e']

  test('when swapping first and last items', () => {
    const result = swap(ITEMS, 0, 4)

    expect(result).toStrictEqual(['e', 'b', 'c', 'd', 'a'])
  })

  test('when swapping first and last items with reversed indices', () => {
    const result = swap(ITEMS, 4, 0)

    expect(result).toStrictEqual(['e', 'b', 'c', 'd', 'a'])
  })

  test('when swapping two items in the middle of the array', () => {
    const result = swap(ITEMS, 3, 1)

    expect(result).toStrictEqual(['a', 'd', 'c', 'b', 'e'])
  })

  test('when swapping the 3rd and 5th items', () => {
    const result = swap(ITEMS, 2, 4)

    expect(result).toStrictEqual(['a', 'b', 'e', 'd', 'c'])
  })

  test('when swapping the 1st and 3rd items', () => {
    const result = swap(ITEMS, 0, 2)

    expect(result).toStrictEqual(['c', 'b', 'a', 'd', 'e'])
  })
})

describe('traverse()', () => {
  test('when traversing', () => {
    const onKeyStub = mock()

    traverse(SCHEMA, onKeyStub)

    expect(onKeyStub).toHaveBeenCalledTimes(KEY_PATHS.length)

    KEY_PATHS.forEach((path, index) => {
      expect(onKeyStub).toHaveBeenNthCalledWith(
        index + 1,
        path,
        getValueByPath(SCHEMA, path),
      )
    })
  })

  test('when traversing with root enabled', () => {
    const PATHS = [[], ...KEY_PATHS]
    const onKeyStub = mock()

    traverse(SCHEMA, onKeyStub, true)

    expect(onKeyStub).toHaveBeenCalledTimes(PATHS.length)

    PATHS.forEach((path, index) => {
      expect(onKeyStub).toHaveBeenNthCalledWith(
        index + 1,
        path,
        getValueByPath(SCHEMA, path),
      )
    })
  })

  test('when mutating the object while traversing', () => {
    const schema = { ...SCHEMA }
    const expectedResult = [...KEY_PATHS]

    expectedResult.splice(6, 1)
    expectedResult.splice(7, 1)

    const mutator = (keyPath, value) => {
      if (Array.isArray(value)) {
        setValueByPath(schema, keyPath, [])
      }
    }

    traverse(schema, mutator)

    const onKeyStub = mock(mutator)

    traverse(schema, onKeyStub)

    expect(onKeyStub).toHaveBeenCalledTimes(expectedResult.length)

    expectedResult.forEach((path, index) => {
      expect(onKeyStub).toHaveBeenNthCalledWith(
        index + 1,
        path,
        getValueByPath(schema, path),
      )
    })
  })

  test('when a null object is found during traversal', () => {
    const obj = {
      userId: {
        id: null,
        label: 'None',
      },
    }

    const fn = keyPath => {
      if (keyPath[0] === 'userId') {
        setValueByPath(obj, keyPath, null)
      }
    }

    const act = () => traverse(obj, fn)

    expect(act).not.toThrow()
  })
})

describe('map()', () => {
  const OBJ_NUMERIC = {
    a: 1,
    b: { c: 2, d: 3 },
    e: [5, 8, 13],
  }

  const OBJ_STRING = {
    a: '1',
    b: { c: '2', d: '3' },
    e: ['5', '8', '13'],
  }

  test('when mapping numeric values to strings', () => {
    const result = map(OBJ_NUMERIC, (_, v) => `${v}`)

    expect(result).toStrictEqual(OBJ_STRING)
  })

  test('when mapping string values to numbers', () => {
    const result = map(OBJ_STRING, (_, v) => Number(v))

    expect(result).toStrictEqual(OBJ_NUMERIC)
  })
})

describe('deepEqual()', () => {
  describe('primitives', () => {
    test('when comparing two different primitive types', () => {
      const result = deepEqual(1, '1')

      expect(result).toBe(false)
    })

    test('when comparing NaN to a number', () => {
      const result = deepEqual(NaN, 1)

      expect(result).toBe(false)
    })

    test('when comparing two identical primitives', () => {
      const result = deepEqual(42, 42)

      expect(result).toBe(true)
    })

    test('when comparing NaN to NaN', () => {
      const result = deepEqual(NaN, NaN)

      expect(result).toBe(true)
    })
  })

  describe('null and undefined', () => {
    test('when comparing null to an object', () => {
      const result = deepEqual(null, {})

      expect(result).toBe(false)
    })

    test('when comparing null to undefined', () => {
      const result = deepEqual(null, undefined)

      expect(result).toBe(false)
    })

    test('when comparing null to null', () => {
      const result = deepEqual(null, null)

      expect(result).toBe(true)
    })

    test('when comparing undefined to undefined', () => {
      const result = deepEqual(undefined, undefined)

      expect(result).toBe(true)
    })
  })

  describe('arrays', () => {
    test('when comparing arrays with different lengths', () => {
      const result = deepEqual([1, 2], [1, 2, 3])

      expect(result).toBe(false)
    })

    test('when comparing arrays with different elements', () => {
      const result = deepEqual([1, 2, 3], [1, 4, 3])

      expect(result).toBe(false)
    })

    test('when comparing identical arrays', () => {
      const result = deepEqual([1, 2, 3], [1, 2, 3])

      expect(result).toBe(true)
    })

    test('when comparing nested arrays', () => {
      const result = deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])

      expect(result).toBe(true)
    })
  })

  describe('plain objects', () => {
    test('when comparing objects with different key counts', () => {
      const result = deepEqual({ a: 1 }, { a: 1, b: 2 })

      expect(result).toBe(false)
    })

    test('when comparing objects with different keys', () => {
      const result = deepEqual({ a: 1 }, { b: 1 })

      expect(result).toBe(false)
    })

    test('when comparing objects with different values', () => {
      const result = deepEqual({ a: 1 }, { a: 2 })

      expect(result).toBe(false)
    })

    test('when comparing objects with different constructors', () => {
      const result = deepEqual([], {})

      expect(result).toBe(false)
    })

    test('when comparing identical objects', () => {
      const result = deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })

      expect(result).toBe(true)
    })

    test('when comparing nested objects', () => {
      const a = { x: { y: { z: 1 } } }
      const b = { x: { y: { z: 1 } } }
      const result = deepEqual(a, b)

      expect(result).toBe(true)
    })
  })

  describe('maps', () => {
    test('when comparing maps with different sizes', () => {
      const a = new Map([['a', 1]])
      const b = new Map([['a', 1], ['b', 2]])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing maps with different keys', () => {
      const a = new Map([['a', 1]])
      const b = new Map([['b', 1]])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing maps with different values', () => {
      const a = new Map([['a', 1]])
      const b = new Map([['a', 2]])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing identical maps', () => {
      const a = new Map([['a', 1], ['b', 2]])
      const b = new Map([['a', 1], ['b', 2]])
      const result = deepEqual(a, b)

      expect(result).toBe(true)
    })
  })

  describe('sets', () => {
    test('when comparing sets with different sizes', () => {
      const a = new Set([1, 2])
      const b = new Set([1, 2, 3])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing sets with different elements', () => {
      const a = new Set([1, 2])
      const b = new Set([1, 3])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing identical sets', () => {
      const a = new Set([1, 2, 3])
      const b = new Set([1, 2, 3])
      const result = deepEqual(a, b)

      expect(result).toBe(true)
    })
  })

  describe('typed arrays', () => {
    test('when comparing typed arrays with different lengths', () => {
      const a = new Uint8Array([1, 2])
      const b = new Uint8Array([1, 2, 3])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing typed arrays with different elements', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([1, 4, 3])
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing identical typed arrays', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([1, 2, 3])
      const result = deepEqual(a, b)

      expect(result).toBe(true)
    })
  })

  describe('regexps', () => {
    test('when comparing regexps with different sources', () => {
      const result = deepEqual(/abc/, /def/)

      expect(result).toBe(false)
    })

    test('when comparing regexps with different flags', () => {
      const result = deepEqual(/abc/i, /abc/g)

      expect(result).toBe(false)
    })

    test('when comparing identical regexps', () => {
      const result = deepEqual(/abc/gi, /abc/gi)

      expect(result).toBe(true)
    })
  })

  describe('dates', () => {
    test('when comparing dates with different timestamps', () => {
      const a = new Date(1000)
      const b = new Date(2000)
      const result = deepEqual(a, b)

      expect(result).toBe(false)
    })

    test('when comparing identical dates', () => {
      const a = new Date(1000)
      const b = new Date(1000)
      const result = deepEqual(a, b)

      expect(result).toBe(true)
    })
  })
})

describe('deepCopy()', () => {
  test('when copying an object', () => {
    const result = deepCopy(SCHEMA)

    expect(result).toStrictEqual(SCHEMA)
  })
})

describe('setValueByPath()', () => {
  function gen () {
    return {
      a: 12,
      b: '123',
      c: {
        d: ['asdf'],
      },
      e: '456',
    }
  }

  test('when setting a top-level property', () => {
    const schema = gen()

    setValueByPath(schema, ['a'], 42)

    expect(schema.a).toBe(42)
  })

  test('when setting the last top-level property', () => {
    const schema = gen()

    setValueByPath(schema, ['e'], 42)

    expect(schema.e).toBe(42)
  })

  test('when assigning a new property', () => {
    const schema = gen()

    setValueByPath(schema, ['f'], 42)

    expect(schema.f).toBe(42)
  })

  test('when overriding an object-type property', () => {
    const schema = gen()

    setValueByPath(schema, ['c'], 42)

    expect(schema.c).toBe(42)
  })

  test('when setting a property on a sub-object', () => {
    const schema = gen()

    setValueByPath(schema, ['c', 'd'], [42])

    expect(schema.c.d).toEqual([42])
  })

  test('when setting a property within an array', () => {
    const schema = gen()

    setValueByPath(schema, ['c', 'd', '0'], 42)

    expect(schema.c.d[0]).toBe(42)
  })
})

describe('getValueByPath()', () => {
  const SCHEMA = {
    a: 12,
    b: '123',
    c: {
      d: ['asdf'],
    },
    e: '456',
  }

  test('when the path does not exist', () => {
    const result = getValueByPath(SCHEMA, ['x'])

    expect(result).toBeUndefined()
  })

  test('when the path does not exist beyond root', () => {
    const result = getValueByPath(SCHEMA, ['x', 'y'])

    expect(result).toBeUndefined()
  })

  test('when the path is empty', () => {
    const result = getValueByPath(SCHEMA, [])

    expect(result).toBe(SCHEMA)
  })

  test('when getting a top-level value', () => {
    const result = getValueByPath(SCHEMA, ['a'])

    expect(result).toBe(12)
  })

  test('when getting the last top-level value', () => {
    const result = getValueByPath(SCHEMA, ['e'])

    expect(result).toBe('456')
  })

  test('when getting an object-type value', () => {
    const result = getValueByPath(SCHEMA, ['c'])

    expect(result).toStrictEqual({ d: ['asdf'] })
  })

  test('when getting a nested value', () => {
    const result = getValueByPath(SCHEMA, ['c', 'd'])

    expect(result).toStrictEqual(['asdf'])
  })

  test('when getting a value from an array', () => {
    const result = getValueByPath(SCHEMA, ['c', 'd', '0'])

    expect(result).toBe('asdf')
  })
})

describe('getKeyPaths()', () => {
  test('when called with an object', () => {
    const result = getKeyPaths(SCHEMA)

    expect(result).toStrictEqual(KEY_PATHS)
  })
})
