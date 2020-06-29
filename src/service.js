import equal from 'fast-deep-equal'

import {
  moveItem,
  swap,
  traverse,
  map,
  deepCopy,
  getValueByPath,
  setValueByPath,
  getKeyPaths,
} from './utils'

const errCb = selector => Array.isArray(selector) || selector.validators
const pristineCb = selector => selector.clipPristine

function printValue (v) {
  return typeof v === 'object' ? JSON.stringify(v, '', 2) : v
}

class ValidationError extends Error {
  constructor (message) {
    super(message)
  }
}

export class VerificationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'VerificationError'
  }
}

export class PristineError extends Error {
  constructor (keyPath) {
    super(`Selector (${keyPath.join('.')}) cannot have pristine state`)
    this.name = 'PristineError'
  }
}

export class MutationError extends Error {
  constructor (keyPath, oldValue, newValue) {
    super(`Reshaping on mutation not allowed at path: ${keyPath}
Old Value: ${printValue(oldValue)}
New Value: ${printValue(newValue)}`)
    this.name = 'MutationError'
  }
}

export class PathError extends Error {
  constructor(keyPath) {
    super(`No key found in state for path: ${keyPath.join('.')}`)
    this.name = 'PathError'
  }
}

export default class FormService {
  get isDirty () {
    return !equal(this.__state, this.__initialState)
  }

  get hasErrors () {
    const fn = obj =>
      Object.values(obj).filter(v =>
        (typeof v === 'object' ? fn(v) : v)).length > 0

    return fn(this.__errors)
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
    this.__state = this.__convert(model, 'format')
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

  apply (name, value) {
    const keyPath = name.split('.')
    const pristine = getValueByPath(this.__pristine, keyPath)

    if (typeof pristine === 'object') {
      throw new PristineError(keyPath)
    }

    this.__verifyValue(keyPath, value)
    setValueByPath(this.__state, keyPath, value)

    this.validateKey(keyPath)
    setValueByPath(this.__pristine, keyPath, false)

    this.__spreadSchema('__state', keyPath)
    this.__modify(keyPath)
  }

  addItem (name, index = -1) {
    const keyPath = name.split('.')
    const items = getValueByPath(this.__state, keyPath)
    const shiftedIndex = index !== -1 ? index : items.length
    const selector = this.getSelector(keyPath)
    const rawItem = selector.genItem()
    const item = this.__convertItem(rawItem, keyPath)

    items.splice(shiftedIndex, 0, item)
    this.__spreadSchema('__state', [...keyPath, shiftedIndex])
    this.__addItemToSchema('__errors', keyPath, shiftedIndex, item, '', errCb)
    this.__addItemToSchema('__pristine', keyPath, shiftedIndex, item, true, pristineCb)
    this.__modifyPristineItem([...keyPath, shiftedIndex])
    this.__modify(keyPath)
    this.__change()
  }

  removeItem (name, index = -1) {
    const keyPath = name.split('.')
    const items = getValueByPath(this.__state, keyPath)
    const shiftedIndex = index === -1 ? items.length - 1 : index

    items.splice(shiftedIndex, 1)
    this.__spreadSchema('__state', [...keyPath, `${shiftedIndex}`])
    this.__removeItemFromSchema('__errors', keyPath, shiftedIndex)
    this.__removeItemFromSchema('__pristine', keyPath, shiftedIndex)
    this.__modify(keyPath)
    this.__change()
  }

  moveItem (name, fromIndex, toIndex) {
    const keyPath = name.split('.')

    this.__moveItemInSchema('__state', keyPath, fromIndex, toIndex)
    this.__moveItemInSchema('__errors', keyPath, fromIndex, toIndex)
    this.__moveItemInSchema('__pristine', keyPath, fromIndex, toIndex)
    this.__change()
  }

  swapItems (name, index1, index2) {
    const keyPath = name.split('.')

    this.__swapItemsInSchema('__state', keyPath, index1, index2)
    this.__swapItemsInSchema('__errors', keyPath, index1, index2)
    this.__swapItemsInSchema('__pristine', keyPath, index1, index2)

    setValueByPath(this.__pristine, [...keyPath, index1], false)
    setValueByPath(this.__pristine, [...keyPath, index2], false)

    this.__change()
  }

  buildModel () {
    return this.__convert(this.__state, 'unformat')
  }

  validate () {
    const prevErrors = this.__errors

    this.__pristine = map(this.__pristine, () => false)
    traverse(this.__state, keyPath => {
      const pristine = getValueByPath(this.__pristine, keyPath)

      if (typeof pristine !== 'object') {
        this.validateKey(keyPath)
      }
    })

    if (prevErrors !== this.__errors) {
      this.__change()
    }

    return !this.hasErrors
  }

  validateKey (keyPath) {
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

    if (validators && !pristine) {
      this.__processValidator(keyPath, validatorPath, validators)
    }
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
    this.__onChange(this.isDirty, this.__state, this.__errors)
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

      if (typeof v === 'object') {
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
    const oldValue = getValueByPath(this.__state, keyPath)

    if (oldValue === undefined) {
      throw new TypeError(`Invalid path: ${keyPath.join('.')}`)
    }

    if (oldValue !== null && value !== null) {
      if (typeof oldValue === 'object') {
        const oldPathMap = getKeyPaths(oldValue)

        if (typeof value === 'object') {
          const pathMap = getKeyPaths(value)

          if (!equal(oldPathMap, pathMap)) {
            throw new MutationError(keyPath, value, oldValue)
          }
        } else {
          throw new MutationError(keyPath, value, oldValue)
        }
      }
    }
  }

  __buildSchema (refSchema, initialValue, fn, rootPath = [], forArr = false) {
    const rootSelector = this.getSelector(rootPath)

    if (rootSelector) {
      const children = rootSelector.children

      if (children && children.$ && fn(children.$)) {
        return initialValue
      }
    }

    const result = Array.isArray(refSchema) ? [] : {}
    traverse(refSchema, (keyPath, value) => {
      const dateType = value instanceof Date

      if (!dateType && value !== null && typeof value === 'object') {
        const arrTerm = forArr ? '0' : ''
        const fullPath = [...rootPath, arrTerm, ...keyPath].filter(item => item)
        const selector = this.getSelector(fullPath)

        if (selector && fn(selector)) {
          setValueByPath(result, keyPath, initialValue)
          return false
        }

        setValueByPath(result, keyPath, Array.isArray(value) ? [] : {})
      } else {
        setValueByPath(result, keyPath, initialValue)
      }
    })

    return result
  }

  __convert (data, op, rootPath = []) {
    const result = typeof data === 'object' ? deepCopy(data) : data

    traverse(result, (keyPath, value) => {
      const fullPath = [...rootPath, ...keyPath]
      const selector = this.getSelector(fullPath, true)

      if (selector && selector[op]) {
        const selVal = selector[op](value)

        if (selVal !== null && typeof selVal === 'object') {
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

  __convertItem (data, rootPath = []) {
    const item = typeof data === 'object' ? deepCopy(data) : data
    const result = this.__convert([item], 'format', rootPath)

    return result[0]
  }

  __spreadSchema (schemaKey, keyPath) {
    this[schemaKey] = { ...this[schemaKey] }

    if (keyPath.length > 1) {
      keyPath.slice(0, keyPath.length - 1).forEach((_, index) => {
        const subPath = keyPath.slice(0, index + 1)
        const subObj = getValueByPath(this.__state, subPath)
        const result = Array.isArray(subObj) ? [...subObj] : { ...subObj }

        setValueByPath(this.__state, subPath, result)
      })
    }
  }

  __addItemToSchema (schemaKey, keyPath, index, item, defaultValue, fn) {
    const value = getValueByPath(this[schemaKey], keyPath)

    if (typeof value === 'object') {
      const subObj = (typeof item === 'object')
        ? this.__buildSchema(item, defaultValue, fn, keyPath, true)
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
        if (typeof item === 'object') {
          return Array.isArray(item) ? [...item] : { ...item }
        }

        return item
      })

      setValueByPath(this[schemaKey], keyPath, result)
      this.__spreadSchema(schemaKey, keyPath)
    }
  }

  __swapItemsInSchema (schemaKey, keyPath, index1, index2) {
    const items = getValueByPath(this[schemaKey], keyPath)

    if (Array.isArray(items)) {
      const result = swap(items, index1, index2)

      setValueByPath(this[schemaKey], keyPath, result)
      this.__spreadSchema(schemaKey, [...keyPath, index1])
      this.__spreadSchema(schemaKey, [...keyPath, index2])
    }
  }

  __modify (keyPath) {
    const pristine = getValueByPath(this.__pristine, keyPath)
    if (pristine && typeof pristine !== 'object') {
      setValueByPath(this.__pristine, keyPath, false)
    }

    this.__change()
  }

  __processValidator (keyPath, validatorPath, validators) {
    const value = getValueByPath(this.__state, validatorPath)

    try {
      validators.forEach(validator => {
        if (!validator.validate(value, validatorPath, this.__state, this)) {
          throw new ValidationError(validator.error)
        }
      })

      setValueByPath(this.__errors, validatorPath, '')
    } catch (e) {
      if (e instanceof ValidationError) {
        setValueByPath(this.__errors, validatorPath, e.message)
      } else {
        throw e
      }
    }

    this.__spreadSchema('__errors', validatorPath)
  }

  __refreshErrors () {
    this.__errors = this.__buildSchema(this.__state, '', selector =>
      Array.isArray(selector) || selector.validators)
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

    if (typeof pristine === 'object') {
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
