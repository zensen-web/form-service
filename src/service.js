import equal from 'fast-deep-equal'

import {
  ValidationError,
  VerificationError,
  PristineError,
  MutationError,
  PathError,
} from './error'

import {
  moveItem,
  swap,
  traverse,
  map,
  deepCopy,
  getValueByPath,
  setValueByPath,
  getKeyPaths,
  isObjectOrArray,
} from './utils'

const errCb = selector => Array.isArray(selector) || selector.validators
const pristineCb = selector => selector.clipPristine

function pathToKeyPath (path) {
  const str = `${path}`

  return str ? str.split('.') : []
}

export default class Service {
  get isDirty () {
    return !equal(this.__state, this.__initialState)
  }

  get isPristine () {
    const fn = obj =>
      !Object.values(obj).filter(v =>
        (isObjectOrArray(v) ? fn(v) : v)).length

    return isObjectOrArray(this.__pristine)
      ? fn(this.__pristine)
      : this.__pristine
  }

  get hasErrors () {
    const fn = obj =>
      Object.values(obj).filter(v =>
        (isObjectOrArray(v) ? fn(v) : v)).length > 0

    return isObjectOrArray(this.__errors)
      ? fn(this.__errors)
      : Boolean(this.__errors)
  }

  constructor (model, selectors, onChange) {
    this.__state = {}
    this.__errors = {}
    this.__pristine = {}
    this.__selectors = selectors
    this.__onChange = onChange

    this.refresh(model)
    this.__verifySelectors()
  }

  refresh (model) {
    this.__state = deepCopy(model)
    this.__state = this.convert(model, 'format')
    this.__initialState = deepCopy(this.__state)
    this.__refreshErrors()
    this.__refreshPristine()
    this.__change()
  }

  reset () {
    this.__state = deepCopy(this.__initialState)
    this.__refreshErrors()
    this.__refreshPristine()
    this.__change()
  }

  apply (path, value) {
    const keyPath = pathToKeyPath(path)

    if (path && value === this.__state) {
      throw new MutationError(keyPath, value, this.__state)
    }

    const pristine = getValueByPath(this.__pristine, keyPath)
    if (isObjectOrArray(pristine)) {
      throw new PristineError(keyPath)
    }

    this.__verifyValue(keyPath, value)
    setValueByPath(this.__state, keyPath, value)

    this.validateKey(keyPath)
    setValueByPath(this.__pristine, keyPath, false)

    this.__spreadSchema('__state', keyPath)
    this.__modify(keyPath)
  }

  addItem (path, index = -1) {
    const keyPath = pathToKeyPath(path)
    const items = getValueByPath(this.__state, keyPath)
    const shiftedIndex = index !== -1 ? index : items.length
    const selector = this.getSelector(keyPath)
    const model = this.convert(this.__state, 'unformat')
    const rawItem = selector.createItem(keyPath, shiftedIndex, model, this)
    const item = this.__convertItem(rawItem, keyPath)

    items.splice(shiftedIndex, 0, item)
    this.__spreadSchema('__state', [...keyPath, shiftedIndex])
    this.__addItemToSchema('__errors', keyPath, shiftedIndex, item, '', errCb)
    console.log('adding', this.__pristine, keyPath.join('.'))
    this.__addItemToSchema('__pristine', keyPath, shiftedIndex, item, true, pristineCb)
    console.log('added', this.__pristine, keyPath.join('.'))
    this.__modifyPristineItem([...keyPath, shiftedIndex])
    console.log('modifying', this.__pristine, keyPath.join('.'))
    this.__modify(keyPath)
    console.log('modifying 2', this.__pristine, keyPath.join('.'))
    this.__change()
    console.log('modifying 3', this.__pristine, keyPath.join('.'))
  }

  removeItem (path, index = -1) {
    const keyPath = pathToKeyPath(path)
    const items = getValueByPath(this.__state, keyPath)
    const shiftedIndex = index === -1 ? items.length - 1 : index

    items.splice(shiftedIndex, 1)
    this.__spreadSchema('__state', [...keyPath, `${shiftedIndex}`])
    this.__removeItemFromSchema('__errors', keyPath, shiftedIndex)
    this.__removeItemFromSchema('__pristine', keyPath, shiftedIndex)
    this.__modify(keyPath)
    this.__change()
  }

  moveItem (path, fromIndex, toIndex) {
    const keyPath = pathToKeyPath(path)

    this.__moveItemInSchema('__state', keyPath, fromIndex, toIndex)
    this.__moveItemInSchema('__errors', keyPath, fromIndex, toIndex)
    this.__moveItemInSchema('__pristine', keyPath, fromIndex, toIndex)
    this.__change()
  }

  swapItems (path, index1, index2) {
    const keyPath = pathToKeyPath(path)

    this.__swapItemsInSchema('__state', keyPath, index1, index2)
    this.__swapItemsInSchema('__errors', keyPath, index1, index2)
    this.__swapItemsInSchema('__pristine', keyPath, index1, index2)

    setValueByPath(this.__pristine, [...keyPath, index1], false)
    setValueByPath(this.__pristine, [...keyPath, index2], false)

    this.__change()
  }

  convert (data, op, rootPath = []) {
    const rootSelector = this.getSelector([], true)
    const action = rootSelector && rootSelector[op]
    const copy = isObjectOrArray(data) ? deepCopy(data) : data
    const result = action ? action(copy, rootPath, data) : copy

    const resultCopy = isObjectOrArray(data) ? deepCopy(result) : result

    traverse(resultCopy, (keyPath, value) => {
      const fullPath = [...rootPath, ...keyPath]
      const selector = this.getSelector(fullPath, true)

      if (selector && selector[op]) {
        const selVal = selector[op](value, fullPath, data)

        if (selVal !== null && isObjectOrArray(selVal)) {
          const copy = selVal instanceof Date
            ? new Date(selVal.getTime())
            : deepCopy(selVal)

          setValueByPath(result, keyPath, copy)
        } else {
          setValueByPath(result, keyPath, selVal)
        }
      }
    })

    return result
  }

  build () {
    return this.convert(this.__state, 'unformat')
  }

  validate () {
    this.__pristine = map(this.__pristine, () => false)

    traverse(this.__state, keyPath => {
      const pristine = getValueByPath(this.__pristine, keyPath)

      if (pristine !== undefined && pristine !== null && !isObjectOrArray(pristine)) {
        this.validateKey(keyPath, true)
      }
    })

    return !this.hasErrors
  }

  validateKey (keyPath, force = false) {
    const clippedPathIndex = keyPath.findIndex((_, index) => {
      const subPath = keyPath.slice(0, index)

      return this.getValidators(subPath)
    })

    const validatorPathLength = clippedPathIndex !== -1
      ? clippedPathIndex
      : keyPath.length

    const validatorPath = keyPath.slice(0, validatorPathLength)
    const validators = this.getValidators(validatorPath)
    const pristine = getValueByPath(this.__pristine, keyPath)
    const prevErrors = this.__errors

    if (validators && (!pristine || force)) {
      const selector = this.getSelector(validatorPath)
      const useRaw = selector.validateRaw || false

      if (!selector.validateManually || force) {
        this.__processValidator(validatorPath, validators, useRaw)
      }
    }

    if (prevErrors !== this.__errors) {
      this.__change()
    }
  }

  unsetPristine (keyPath) {
    if (typeof getValueByPath(this.__pristine, keyPath) !== 'boolean') {
      throw new TypeError(`Invalid path: ${keyPath.join('.')}`)
    }

    setValueByPath(this.__pristine, keyPath, false)
  }

  getSelectorPath (keyPath, ignoreCheck = false) {
    if (!ignoreCheck) {
      const value = getValueByPath(this.__state, keyPath)

      if (value === undefined) {
        throw new PathError(keyPath)
      }
    }

    const initialValue = keyPath.length ? ['children'] : []

    return keyPath.reduce((accum, curr, index) => {
      const parentPath = keyPath.slice(0, index)
      const parent = getValueByPath(this.__state, parentPath)
      const key = Array.isArray(parent) ? '$' : curr

      return (index < keyPath.length - 1)
        ? [...accum, key, 'children']
        : [...accum, key]
    }, initialValue)
  }

  getSelector (keyPath, ignoreCheck = false) {
    const selectorPath = this.getSelectorPath(keyPath, ignoreCheck)

    return getValueByPath(this.__selectors, selectorPath)
  }

  getValidators (keyPath) {
    const selector = this.getSelector(keyPath)

    if (selector) {
      return Array.isArray(selector) ? selector : selector.validators
    }

    return null
  }

  __change () {
    this.__onChange(this.isDirty, this.__state, this.__errors, this.__pristine)
  }

  __verifySelectors () {
    traverse(this.__state, (keyPath, v) => {
      const validators = this.getValidators(keyPath)

      if (validators) {
        const parentPath = keyPath.slice(0, keyPath.length - 1)

        parentPath.forEach((_, index) => {
          const ancestorPath = parentPath.slice(0, index + 1)
          const ancestorValidators = this.getValidators(ancestorPath)

          if (ancestorValidators) {
            throw new VerificationError(`Selector (${
              keyPath.join('.')
            }) has ancestor selector with validators: ${
              ancestorPath.join('.')
            }`)
          }
        })
      }

      if (isObjectOrArray(v)) {
        const selectors = this.getSelector(keyPath)

        if (selectors && selectors.ignorePristine && !selectors.clipPristine) {
          const msg = `ignorePristine set object-type key for path: ${
            keyPath.join('.')
          }. Perhaps you meant to use clipPristine?`

          throw new VerificationError(msg)
        }
      }
    })
  }

  __verifyValue (keyPath, value) {
    const selector = this.getSelector(keyPath, true)
    const oldValue = getValueByPath(this.__state, keyPath)

    if (!selector || !selector.unsafe) {
      if (oldValue === undefined) {
        throw new TypeError(`Invalid path: ${keyPath.join('.')}`)
      }

      if (oldValue !== null && value !== null) {
        if (isObjectOrArray(oldValue)) {
          const oldPathMap = getKeyPaths(oldValue)

          if (isObjectOrArray(value)) {
            const pathMap = getKeyPaths(value)

            if (!equal(oldPathMap, pathMap)) {
              throw new MutationError(keyPath, oldValue, value)
            }
          } else {
            throw new MutationError(keyPath, oldValue, value)
          }
        }
      }
    }
  }

  __buildSchema (refSchema, initialValue, fn, rootPath = []) {
    const result = Array.isArray(refSchema) ? [] : {}
    const rootSelector = this.getSelector(rootPath)

    if (rootSelector && fn(rootSelector)) {
      return initialValue
    }

    traverse(refSchema, (keyPath, value) => {
      const dateType = value instanceof Date

      if (!dateType && value !== null && isObjectOrArray(value)) {
        const fullPath = [...rootPath, ...keyPath]
        const selector = this.getSelector(fullPath)

        if (selector && fn(selector)) {
          setValueByPath(result, keyPath, initialValue)
          return false
        }

        setValueByPath(result, keyPath, Array.isArray(value) ? [] : {})
      } else {
        setValueByPath(result, keyPath, initialValue)
      }
    }, true)

    return result
  }

  __convertItem (data, rootPath = []) {
    const item = isObjectOrArray(data) ? deepCopy(data) : data
    const result = this.convert([item], 'format', rootPath)

    return result[0]
  }

  __spreadSchema (schemaKey, keyPath) {
    const ref = this[schemaKey]
    this[schemaKey] = Array.isArray(ref) ? [...ref] : { ...ref }

    if (keyPath.length > 1) {
      keyPath.slice(0, keyPath.length - 1).forEach((_, index) => {
        const subPath = keyPath.slice(0, index + 1)
        const subObj = getValueByPath(this[schemaKey], subPath)
        const result = Array.isArray(subObj) ? [...subObj] : { ...subObj }

        setValueByPath(this[schemaKey], subPath, result)
      })
    }
  }

  __addItemToSchema (schemaKey, keyPath, index, item, defaultValue, fn) {
    const value = getValueByPath(this[schemaKey], keyPath)

    if (isObjectOrArray(value)) {
      const selector = this.getSelector(keyPath)
      const clipElement =
        selector &&
        selector.children &&
        selector.children.$ &&
        fn(selector.children.$)

      const subObj = !clipElement && (isObjectOrArray(item))
        ? this.__buildSchema(item, defaultValue, fn, [...keyPath, `${index}`])
        : defaultValue

      value.splice(index, 0, subObj)
      this.__spreadSchema(schemaKey, [...keyPath, `${index}`])
    }
  }

  __removeItemFromSchema (schemaKey, keyPath, index) {
    const item = getValueByPath(this[schemaKey], keyPath)

    if (Array.isArray(item)) {
      item.splice(index, 1)

      this.__spreadSchema(schemaKey, [...keyPath, `${index}`])
    }
  }

  __moveItemInSchema (schemaKey, keyPath, fromIndex, toIndex) {
    const items = getValueByPath(this[schemaKey], keyPath)

    if (Array.isArray(items)) {
      const result = moveItem(items, fromIndex, toIndex).map(item => {
        if (isObjectOrArray(item)) {
          return Array.isArray(item) ? [...item] : { ...item }
        }

        return item
      })

      if (keyPath.length) {
        setValueByPath(this[schemaKey], keyPath, result)
      } else {
        this[schemaKey] = result
      }

      this.__spreadSchema(schemaKey, keyPath)
    }
  }

  __swapItemsInSchema (schemaKey, keyPath, index1, index2) {
    const items = getValueByPath(this[schemaKey], keyPath)

    if (Array.isArray(items)) {
      const result = swap(items, index1, index2)

      if (keyPath.length) {
        setValueByPath(this[schemaKey], keyPath, result)
      } else {
        this[schemaKey] = result
      }

      this.__spreadSchema(schemaKey, [...keyPath, index1])
      this.__spreadSchema(schemaKey, [...keyPath, index2])
    }
  }

  __modify (keyPath) {
    const pristine = getValueByPath(this.__pristine, keyPath)
    if (pristine && !isObjectOrArray(pristine)) {
      setValueByPath(this.__pristine, keyPath, false)
    }

    this.__change()
  }

  __processValidator (keyPath, validators, useRaw) {
    const data = useRaw ? this.convert(this.__state, 'unformat') : this.__state
    const value = getValueByPath(data, keyPath)

    try {
      validators.forEach(validator => {
        if (!validator.validate(value, keyPath, data, this)) {
          throw new ValidationError(validator.error)
        }
      })

      this.__setError(keyPath, '')
    } catch (e) {
      if (e instanceof ValidationError) {
        this.__setError(keyPath, e.message)
      } else {
        throw e
      }
    }
  }

  __refreshErrors () {
    this.__errors = this.__buildSchema(this.__state, '', selector =>
      Array.isArray(selector) || selector.validators)
  }

  __setError (keyPath, message) {
    if (keyPath.length) {
      setValueByPath(this.__errors, keyPath, message)
      this.__spreadSchema('__errors', keyPath)
    } else {
      this.__errors = message
    }
  }

  __refreshPristine () {
    this.__pristine = this.__buildSchema(this.__state, true, selector =>
      selector.clipPristine)

    traverse(this.__pristine, keyPath => {
      const selector = this.getSelector(keyPath)

      if (selector && selector.ignorePristine) {
        setValueByPath(this.__pristine, keyPath, false)
      }
    })
  }

  __modifyPristineItem (keyPath) {
    const pristine = getValueByPath(this.__pristine, keyPath)

    if (isObjectOrArray(pristine)) {
      traverse(pristine, subPath => {
        const fullPath = [...keyPath, ...subPath]
        const selector = this.getSelector(fullPath)

        if (selector && selector.ignorePristine) {
          setValueByPath(this.__pristine, fullPath, false)
        }
      })
    } else {
      const selector = this.getSelector(keyPath)

      if (selector && selector.ignorePristine) {
        setValueByPath(this.__pristine, keyPath, false)
      }
    }
  }
}
