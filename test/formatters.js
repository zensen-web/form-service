export const PERIOD = {
  AM: 'am',
  PM: 'pm',
}

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

export function hoursToObj (v) {
  return {
    hours: Math.floor(v > 12 ? v - 12 : v),
    minutes: (v - Math.floor(v)) * 60,
    period: v >= 12 ? PERIOD.PM : PERIOD.AM,
  }
}

export function objToHours (v) {
  const model = map(v, (keyPath, value) =>
    (keyPath[0] !== 'period' ? Number(value) : value))

  const offset = model.period === 'PM' ? 12 : 0

  return model.hours + (model.minutes / 60) + offset
}

export function timeToScalar (time) {
  const periodToMinutes =
    time.period === PERIOD.PM && time.hours !== 12 ? 720 : 0

  return periodToMinutes + (time.hours * 60) + (time.minutes)
}
