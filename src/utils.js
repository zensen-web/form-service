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
  return arr.filter(item => (typeof item === 'object'
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

export function traverse (obj, onKey) {
  const path = ['']

  const fn = target => {
    Object.entries(target).forEach(([k, v]) => {
      path[path.length - 1] = k

      const dateType = v instanceof Date
      const clip = onKey([...path], v) === false
      const updatedVal = getValueByPath(obj, path)
      const nonNullObj = updatedVal !== null && typeof updatedVal === 'object'

      if (!clip && !dateType && nonNullObj) {
        path.push('')
        fn(updatedVal)
        path.pop()
      }
    })
  }

  fn(obj)
}

export function map (obj, onKey) {
  const result = Array.isArray(obj) ? [] : {}

  traverse(obj, (keyPath, value) => {
    const dateType = value instanceof Date

    if (!dateType && value !== null && typeof value === 'object') {
      setValueByPath(result, keyPath, Array.isArray(value) ? [] : {})
    } else {
      setValueByPath(result, keyPath, onKey(keyPath, value))
    }
  })

  return result
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
