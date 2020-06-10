import { extents, getValueByPath } from './utils'

export function required (error = 'Required') {
  return {
    error,
    validate: v => (Array.isArray(v) ? v.length : v),
  }
}

export function requiredIf (siblingKey, error = 'Required') {
  return {
    error,
    validate: (v, keyPath, state) => {
      const siblingPath = [...keyPath]
      siblingPath[siblingPath.length - 1] = siblingKey

      const siblingValue = getValueByPath(state, siblingPath)

      return siblingValue ? v : true
    },
  }
}

export function min (extent, inclusive = true, error = true) {
  return {
    error,
    validate: v => v === '' || (inclusive ? (v >= extent) : (v > extent)),
  }
}

export function max (extent, inclusive = true, error = true) {
  return {
    error,
    validate: v => v === '' || (inclusive ? (v <= extent) : (v < extent)),
  }
}

export function range (ext1, ext2, incMin = true, incMax = true, error = true) {
  const { min, max } = extents(Number(ext1), Number(ext2))

  return {
    error,
    validate: v => {
      const passesMin = incMin ? (v >= min) : (v > min)
      const passesMax = incMax ? (v <= max) : (v < max)

      return v === '' || (passesMin && passesMax)
    },
  }
}
