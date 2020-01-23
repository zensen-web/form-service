export function capitalize (str) {
  return `${str.charAt(0).toUpperCase()}${str.slice(1)}`
}

export function toNumeric (str) {
  return Number(str.replace(/\$|,/g, ''))
}

export function toCurrency (v) {
  return `$${(Number(v))
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}`
}

export function toPhoneNumber (str) {
  const segments = [str.slice(0, 3), str.slice(3, 6), str.slice(6, 10)]

  if (str.length < 4) {
    return segments[0]
  }

  if (str.length < 7) {
    return `(${segments[0]}) ${segments[1]}`
  }

  return `(${segments[0]}) ${segments[1]}-${segments[2]}`
}
