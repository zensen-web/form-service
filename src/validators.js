import pkg from 'validator'

import { extents, getValueByPath } from './utils'

export function isRequired (error = 'Required') {
  return {
    error,
    validate: v => (Array.isArray(v) ? v.length : v),
  }
}

export function isRequiredIf (siblingKey, autoValidate = true, error = 'Required') {
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

export function isPropRequired (path, error = 'Required') {
  return {
    error,
    validate: v => {
      const prop = getValueByPath(v, path.split('.'))

      return (Array.isArray(prop) ? prop.length : prop)
    },
  }
}

export function isSsn (error = '###-##-####') {
  return {
    error,
    validate: v => {
      const REGEX_SSN = new RegExp(/^\d{3}-\d{2}-\d{4}$/g)
      const result = v.match(REGEX_SSN)

      return !v || Boolean(result && result.length)
    },
  }
}

export function isDate (fmt = 'mm/dd/yyyy', error = 'mm/dd/yyyy') {
  return {
    error,
    validate: v => !v || pkg.isDate(v, fmt),
  }
}

export function isDateBefore (targetDate, error = 'Date is too late') {
  return {
    error,
    validate: v => !v || pkg.isBefore(v, targetDate),
  }
}

export function isDateAfter (targetDate, error = 'Date is too early') {
  return {
    error,
    validate: v => !v || pkg.isAfter(v, targetDate),
  }
}

export function isEmailAddress (error = 'Invalid email') {
  return {
    error,
    validate: v => !v || pkg.isEmail(v),
  }
}

export function isPhoneNumber (error = 'Invalid phone number') {
  return {
    error,
    validate: v => !v || pkg.isMobilePhone(v),
  }
}

export function isPostalCode (locale = 'US', error = 'Invalid Postal Code') {
    return {
    error,
    validate: v => !v || pkg.isPostalCode(v, locale),
  }
}

export function hasLength (length, error = null) {
  return {
    error: error || `Must be ${length} characters`,
    validate: v => !v || v.length === length,
  }
}

export function hasDuplicate (error = 'Duplicate') {
  return {
    error,
    validate: (v, keyPath, state) => {
      const revPath = [...keyPath].reverse()
      const lastKey = revPath[0]
      const targetIndex = Number(revPath[1])
      const rootPath = keyPath.slice(0, keyPath.length - 2)
      const items = getValueByPath(state, rootPath)
      const values = items
        .map(item => item[lastKey])
        .filter((_, index) => index !== targetIndex)

      return values.indexOf(v) === -1
    },
  }
}

export function atMin (extent, inclusive = true, error = true) {
  return {
    error,
    validate: v => v === '' || (inclusive ? (v >= extent) : (v > extent)),
  }
}

export function atMax (extent, inclusive = true, error = true) {
  return {
    error,
    validate: v => v === '' || (inclusive ? (v <= extent) : (v < extent)),
  }
}

export function inRange (ext1, ext2, incMin = true, incMax = true, error = null) {
  const { min, max } = extents(Number(ext1), Number(ext2))

  return {
    error: error ? error : `${min} - ${max}`,
    validate: v => {
      const passesMin = incMin ? (v >= min) : (v > min)
      const passesMax = incMax ? (v <= max) : (v < max)

      return v === '' || (passesMin && passesMax)
    },
  }
}
