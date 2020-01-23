import sinon from 'sinon'

import {
  extents,
  padArray,
  filterEmpty,
  traverse,
  map,
  deepCopy,
  setValueByPath,
  getValueByPath,
} from '../src/utils'

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

describe('misc', () => {
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('extents()', () => {
    it('returns correct values when params are in ascending order', () =>
      expect(extents(0, 100)).to.be.eql({ min: 0, max: 100 }))

    it('returns correct values when params are in descending order', () =>
      expect(extents(100, 0)).to.be.eql({ min: 0, max: 100 }))
  })

  describe('padArray()', () => {
    context('when the array already has items', () => {
      const ITEMS = [1]

      it('does not modify the array', () =>
        expect(padArray(ITEMS, 0)).to.be.eql([1]))
    })

    context('when the array is empty', () => {
      const ITEMS = []

      it('does not modify the array', () =>
        expect(padArray(ITEMS, 0)).to.be.eql([0]))
    })
  })

  describe('filterEmpty()', () => {
    context('when the array has a discrete, truthy value', () => {
      const ITEMS = [1]

      it('returns an unmodified copy of the array', () =>
        expect(filterEmpty(ITEMS)).to.be.eql(ITEMS))
    })

    context('when the array has a discrete, falsy value', () => {
      const ITEMS = ['']

      it('returns a modified copy of the array', () =>
        expect(filterEmpty(ITEMS)).to.be.eql([]))
    })

    context('when the array has an object with no discrete, falsy values', () => {
      const ITEMS = [{ a: 10, b: 42 }]

      it('returns an unmodified copy of the array', () =>
        expect(filterEmpty(ITEMS)).to.be.eql(ITEMS))
    })

    context('when the array has an object with a discrete, falsy value', () => {
      const ITEMS = [{ a: 0, b: 42 }]

      it('returns a modified copy of the array', () =>
        expect(filterEmpty(ITEMS)).to.be.eql([]))
    })
  })

  describe('traverse()', () => {
    let onKeyStub

    const EXPECTED_RESULT = [
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

    context('when traversing', () => {
      beforeEach(() => {
        onKeyStub = sandbox.stub()
        traverse(SCHEMA, onKeyStub)
      })

      EXPECTED_RESULT.map((path, index) =>
        it(`returns path: ${path}`, () =>
          expect(onKeyStub.getCall(index).args).to.be.eql([
            path,
            getValueByPath(SCHEMA, path),
          ])))
    })

    context('when mutating the object while traversing', () => {
      const schema = { ...SCHEMA }
      const expectedResult = [...EXPECTED_RESULT]
      expectedResult.splice(6, 1)
      expectedResult.splice(7, 1)

      beforeEach(() => {
        onKeyStub = sandbox.stub().callsFake((keyPath, value) => {
          if (Array.isArray(value)) {
            setValueByPath(schema, keyPath, [])
          }
        })

        traverse(schema, onKeyStub)
      })

      expectedResult.map((path, index) =>
        it(`returns path: ${path}`, () =>
          expect(onKeyStub.getCall(index).args).to.be.eql([
            path,
            getValueByPath(schema, path),
          ])))
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

    it('can create a string version of all values', () =>
      expect(map(OBJ_NUMERIC, (_, v) => `${v}`)).to.be.eql(OBJ_STRING))

    it('can create a numeric version of all values', () =>
      expect(map(OBJ_STRING, (_, v) => Number(v))).to.be.eql(OBJ_NUMERIC))
  })

  describe('deepCopy()', () => {
    it('creates an exact copy', () =>
      expect(deepCopy(SCHEMA)).to.be.eql(SCHEMA))
  })

  describe('setValueByPath()', () => {
    let schema

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

    context('when setting a top-level property', () => {
      beforeEach(() => {
        schema = gen()
        setValueByPath(schema, ['a'], 42)
      })

      it('sets the correct value', () =>
        expect(schema.a).to.be.eq(42))
    })

    context('when setting the last top-level property', () => {
      beforeEach(() => {
        schema = gen()
        setValueByPath(schema, ['e'], 42)
      })

      it('sets the correct value', () =>
        expect(schema.e).to.be.eq(42))
    })

    context('when assigning a new property', () => {
      beforeEach(() => {
        schema = gen()
        setValueByPath(schema, ['f'], 42)
      })

      it('sets the correct value', () =>
        expect(schema.f).to.be.eq(42))
    })

    context('when overriding an object-type property', () => {
      beforeEach(() => {
        schema = gen()
        setValueByPath(schema, ['c'], 42)
      })

      it('sets the correct value', () =>
        expect(schema.c).to.be.eq(42))
    })

    context('when setting a property on a sub-object', () => {
      beforeEach(() => {
        schema = gen()
        setValueByPath(schema, ['c', 'd'], [42])
      })

      it('sets the correct value', () =>
        expect(schema.c.d).to.be.eql([42]))
    })

    context('when setting a property within an array', () => {
      beforeEach(() => {
        schema = gen()
        setValueByPath(schema, ['c', 'd', '0'], 42)
      })

      it('sets the correct value', () =>
        expect(schema.c.d[0]).to.be.eq(42))
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

    it('gets the top-level value', () =>
      expect(getValueByPath(SCHEMA, ['a'])).to.be.eq(12))

    it('gets the last top-level value', () =>
      expect(getValueByPath(SCHEMA, ['e'])).to.be.eq('456'))

    it('gets the last top-level value', () =>
      expect(getValueByPath(SCHEMA, ['c'])).to.be.eql({ d: ['asdf'] }))

    it('gets the nested value', () =>
      expect(getValueByPath(SCHEMA, ['c', 'd'])).to.be.eql(['asdf']))

    it('gets the value from an array', () =>
      expect(getValueByPath(SCHEMA, ['c', 'd', '0'])).to.be.eql('asdf'))

    it('returns undefined path does not exist', () =>
      expect(getValueByPath(SCHEMA, ['x'])).to.be.eql(undefined))

    it('returns undefined path does not exist (beyond)', () =>
      expect(getValueByPath(SCHEMA, ['x', 'y'])).to.be.eql(undefined))
  })
})
