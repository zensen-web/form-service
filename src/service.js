import equal from 'fast-deep-equal'

import {
  traverse,
  deepCopy,
  getValueByPath,
  setValueByPath,
} from './utils'

function capitalize (str) {
  return `${str.charAt(0).toUpperCase()}${str.slice(1)}`
}

class ValidationError extends Error {
  constructor (schema) {
    super('')

    this.schema = schema
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
  }

  refresh (model) {
    this.__state = this.__convert(model, 'format')
    this.__initialState = deepCopy(this.__state)
    this.__errors = this.__buildSchema(this.__state, '', 'clipErrors')
    this.__refreshPristine()
    this.__changeState()
  }

  reset () {
    this.__state = deepCopy(this.__initialState)
    this.__errors = this.__buildSchema(this.__state, '', 'clipErrors')
    this.__refreshPristine()
    this.__changeState()
  }

  apply (name, value) {
    const keyPath = name.split('.')
    setValueByPath(this.__state, keyPath, value)

    this.__validateBranch(keyPath)
    this.__spreadSchema('__state', keyPath)
    this.__modify(keyPath)
  }

  addItem (name, index = -1) {
    const keyPath = name.split('.')
    const items = getValueByPath(this.__state, keyPath)
    const shiftedIndex = index !== -1 ? index : items.length
    const selector = this.getSelector(keyPath)
    const item = selector.genItem()

    items.splice(shiftedIndex, 0, item)
    this.__spreadSchema('__state', [...keyPath, `${shiftedIndex}`])
    this.__addItemToSchema('__errors', keyPath, shiftedIndex, item, '')
    this.__addItemToSchema('__pristine', keyPath, shiftedIndex, item, true)
    this.__modifyPristineItem([...keyPath, `${shiftedIndex}`])
    this.__modify(keyPath)
    this.__changeState()
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
    this.__changeState()
  }

  buildModel () {
    return this.__convert(this.__state, 'unformat')
  }

  validate () {
    this.__pristine = this.__buildSchema(this.__state, false, 'clipPristine')
    traverse(this.__errors, (keyPath, value) => {
      if (typeof value !== 'object') {
        this.__validateBranch(keyPath)
      }
    })

    return !this.hasErrors
  }

  getSelector (keyPath) {
    const selectorPath = keyPath.reduce((accum, curr, index) => {
      if (index > 0 && !isNaN(curr)) {
        const parentPath = keyPath.slice(0, index)
        const parent = getValueByPath(this.__state, parentPath)

        if (Array.isArray(parent)) {
          return accum
        }
      }

      return (index < keyPath.length - 1)
        ? [...accum, curr, 'children']
        : [...accum, curr]
    }, [])

    return getValueByPath(this.__selectors, selectorPath)
  }

  getValidators (keyPath) {
    const selector = this.getSelector(keyPath)
    if (selector) {
      return Array.isArray(selector) ? selector : selector.validators
    }

    return null
  }

  setError (keyPath, message) {
    setValueByPath(this.__errors, keyPath, message)

    this.__spreadSchema('__errors', keyPath)
    this.__changeState()
  }

  __changeState () {
    this.__onChange(this.isDirty, this.__state, this.__errors)
  }

  __buildSchema (refSchema, initialValue, clipKey, rootPath = []) {
    if (rootPath) {
      const rootSelector = this.getSelector(rootPath)
      if (rootSelector) {
        const children = rootSelector.children
        if (children && children[clipKey]) {
          return initialValue
        }
      }
    }

    const result = Array.isArray(refSchema) ? [] : {}
    traverse(refSchema, (keyPath, value) => {
      const dateType = value instanceof Date

      if (!dateType && value !== null && typeof value === 'object') {
        const selector = this.getSelector([...rootPath, ...keyPath])

        if (selector && selector[clipKey]) {
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

  __convert (data, op) {
    const result = deepCopy(data)

    traverse(result, (keyPath, value) => {
      const selector = this.getSelector(keyPath)
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

  __addItemToSchema (schemaKey, keyPath, index, item, defaultValue) {
    const clipKey = `clip${capitalize(schemaKey.replace(/_/g, ''))}`
    const value = getValueByPath(this[schemaKey], keyPath)
    const subObj = (typeof item === 'object')
      ? this.__buildSchema(item, defaultValue, clipKey, keyPath)
      : defaultValue

    value.splice(index, 0, subObj)
    this.__spreadSchema(schemaKey, [...keyPath, `${index}`])
  }

  __removeItemFromSchema (schemaKey, keyPath, index) {
    getValueByPath(this[schemaKey], keyPath).splice(index, 1)
    this.__spreadSchema(schemaKey, [...keyPath, `${index}`])
  }

  __modify (keyPath) {
    const pristine = getValueByPath(this.__pristine, keyPath)
    if (pristine && typeof pristine !== 'object') {
      setValueByPath(this.__pristine, keyPath, false)
    }

    this.__changeState()
  }

  __validateBranch (keyPath) {
    const clippedPathIndex = keyPath.findIndex((_, index) => {
      const subPath = keyPath.slice(0, index + 1)
      const selector = this.getSelector(subPath)

      return selector && selector.clipErrors
    })

    const pathList = keyPath
      .slice(0, clippedPathIndex !== -1 ? (clippedPathIndex + 1) : keyPath.length)
      .map((_, index) => keyPath.slice(0, index + 1))
      .reverse()

    /* TODO: reset all errors
        1) Walk up the path
        2) Iterate through all validators
        3) Generate a default schema per validator
        4) Apply the defaulted schema to the error schema to reset it
     */

    if (clippedPathIndex === -1) {
      const subErrors = getValueByPath(this.__errors, keyPath)
      const resetErrors = typeof subErrors === 'object'
        ? this.__buildSchema(subErrors, '', 'clipErrors', keyPath)
        : ''

      setValueByPath(this.__errors, keyPath, resetErrors)
    }

    pathList.forEach((path, index) => {
      const item = getValueByPath(this.__state, path)
      if (!index || !Array.isArray(item)) {
        this.__validateKey(path)
      }
    })
  }

  __validateKey (keyPath) {
    const parentPath = keyPath.slice(0, keyPath.length - 1)
    const parent = getValueByPath(this.__state, parentPath)
    const validatorPath = Array.isArray(parent)
      ? keyPath.slice(0, keyPath.length - 1)
      : keyPath

    const validators = this.getValidators(validatorPath)
    if (validators) {
      const prevError = getValueByPath(this.__errors, keyPath)

      try {
        validators.forEach(validator =>
          this.__processValidator(keyPath, prevError, validator))
      } catch (e) {
        this.__processError(keyPath, e, prevError)
      }
    }
  }

  __processValidator (keyPath, prevError, validator) {
    const pristine = getValueByPath(this.__pristine, keyPath)

    if (!pristine || typeof pristine === 'object') {
      const value = getValueByPath(this.__state, keyPath)
      if (!validator.validate(value, keyPath, this.__state)) {
        throw new ValidationError(validator.error)
      }

      this.__resolveError(keyPath, prevError, validator)
    }
  }

  __processError (keyPath, err, prevError) {
    if (err instanceof ValidationError) {
      if (typeof err.schema === 'object') {
        traverse(err.schema, (errPath, value) => {
          const prevValue = getValueByPath(prevError, errPath)
          if (value && !prevValue && typeof value !== 'object') {
            this.setError([...keyPath, ...errPath], value)
          }
        })
      } else {
        if (equal(prevError, '')) {
          this.setError(keyPath, err.schema)
        }
      }
    } else {
      throw err
    }
  }

  __resolveError (keyPath, prevError, validator) {
    if (typeof validator.error === 'object') {
      traverse(validator.error, (errPath, curr) => {
        if (typeof curr !== 'object') {
          const prev = getValueByPath(prevError, errPath)
          if (prev === curr) {
            this.setError([...keyPath, ...errPath], '')
          }
        }
      })
    } else {
      if (!equal(prevError, '')) {
        this.setError(keyPath, '')
      }
    }
  }

  __refreshPristine () {
    this.__pristine = this.__buildSchema(this.__state, true, 'clipPristine')
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
