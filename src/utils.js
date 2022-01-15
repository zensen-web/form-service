const envHasBigInt64Array = typeof BigInt64Array !== 'undefined'

export function extents (ext1, ext2) {
  return {
    min: ext1 < ext2 ? ext1 : ext2,
    max: ext1 > ext2 ? ext1 : ext2,
  }
}

export function padArray (arr, filler) {
  return arr.length ? arr : [filler]
}

export function filterEmpty (arr) {
  return arr.filter(item => (isObjectOrArray(item)
    ? Object.keys(item).every(key => item[key])
    : item))
}

export function moveItem (arr, fromIndex, toIndex) {
  const target = arr[fromIndex]
  const result = [...arr]

  result.splice(fromIndex, 1)
  result.splice(toIndex, 0, target)
  return result
}

export function swap (arr, index1, index2) {
  const result = [...arr]

  result.splice(index1, 1)
  result.splice(index1, 0, arr[index2])
  result.splice(index2, 1)
  result.splice(index2, 0, arr[index1])
  return result
}

export function traverse (obj, onKey, includeRoot = false) {
  const path = ['']

  const fn = target => {
    Object.entries(target).forEach(([k, v]) => {
      path[path.length - 1] = k

      const dateType = v instanceof Date
      const clip = onKey([...path], v) === false
      const updatedVal = getValueByPath(obj, path)
      const nonNullObj = updatedVal !== null && isObjectOrArray(updatedVal)

      if (!clip && !dateType && nonNullObj) {
        path.push('')
        fn(updatedVal)
        path.pop()
      }
    })
  }

  if (includeRoot) {
    onKey([], obj)
  }

  fn(obj)
}

export function map (obj, onKey) {
  const result = Array.isArray(obj) ? [] : {}

  traverse(obj, (keyPath, value) => {
    const dateType = value instanceof Date

    if (!dateType && value !== null && isObjectOrArray(value)) {
      setValueByPath(result, keyPath, Array.isArray(value) ? [] : {})
    } else {
      setValueByPath(result, keyPath, onKey(keyPath, value))
    }
  })

  return result
}

/* Comes from the fast-deep-equal package. Copied and pasted to try to solve ESM rules... */
export function deepEqual(a, b) {
  if (a === b) {
    return true
  }

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) {
      return false
    }

    let length, i, keys

    if (Array.isArray(a)) {
      length = a.length

      if (length != b.length) {
        return false
      }

      for (i = length; i-- !== 0;) {
        if (!equal(a[i], b[i])) {
          return false
        }
      }

      return true
    }


    if ((a instanceof Map) && (b instanceof Map)) {
      if (a.size !== b.size) {
        return false
      }

      for (i of a.entries()) {
        if (!b.has(i[0])) {
          return false
        }
      }

      for (i of a.entries()) {
        if (!equal(i[1], b.get(i[0]))) {
          return false
        }
      }

      return true
    }

    if ((a instanceof Set) && (b instanceof Set)) {
      if (a.size !== b.size) {
        return false
      }

      for (i of a.entries()) {
        if (!b.has(i[0])) {
          return false
        }
      }

      return true
    }

    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
      length = a.length

      if (length != b.length) {
        return false
      }

      for (i = length; i-- !== 0;) {
        if (a[i] !== b[i]) {
          return false
        }
      }

      return true
    }

    if (a.constructor === RegExp) {
      return a.source === b.source && a.flags === b.flags
    }

    if (a.valueOf !== Object.prototype.valueOf) {
      return a.valueOf() === b.valueOf()
    }

    if (a.toString !== Object.prototype.toString) {
      return a.toString() === b.toString()
    }

    keys = Object.keys(a)
    length = keys.length

    if (length !== Object.keys(b).length) {
      return false
    }

    for (i = length; i-- !== 0;) {
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
        return false
      }
    }

    for (i = length; i-- !== 0;) {
      let key = keys[i]

      if (!equal(a[key], b[key])) {
        return false
      }
    }

    return true
  }

  return a !== a && b !== b
}

export function deepCopy (obj) {
  return map(obj, (_, value) => value)
}

export function setValueByPath (obj, keyPath, value) {
  keyPath.reduce((subObj, key, index) => {
    if (index === keyPath.length - 1) {
      subObj[key] = value
    } else {
      return subObj[key]
    }
  }, obj)
}

export function getValueByPath (obj, keyPath) {
  return keyPath.reduce((obj, key) =>
    (typeof obj !== 'undefined' ? obj[key] : undefined), obj)
}

export function getKeyPaths (obj) {
  const result = []

  traverse(obj, keyPath => result.push(keyPath))

  return result
}

export function isObjectOrArray (value) {
  return value && (Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value))
}
