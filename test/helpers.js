import pkg from 'validator'

import { map, getValueByPath } from '../src/utils'

export const PERIOD = {
  AM: 'am',
  PM: 'pm',
}

export const ENEMY_MODEL = {
  name: 'Gremlin',
  job: 'monster',
  stats: {
    attack: 4,
    evasion: 3,
    speed: 2,
    attributes: {
      level: 9,
      experience: 1000,
    },
  },
  ailments: [3, 4, 7],
  items: [
    { id: 1, rate: 0.1 },
    { id: 3, rate: 0.4 },
  ],
  triangles: [
    [0, 1, 2],
    [0, 2, 3],
  ],
}

export const ENEMY_ERRORS = {
  name: '',
  job: '',
  stats: {
    attack: '',
    evasion: '',
    speed: '',
    attributes: {
      level: '',
      experience: '',
    },
  },
  ailments: ['', '', ''],
  items: [
    { id: '', rate: '' },
    { id: '', rate: '' },
  ],
  triangles: [
    ['', '', ''],
    ['', '', ''],
  ],
}

export const ENEMY_PRISTINE = map(ENEMY_ERRORS, () => true)

export const ENEMY_SELECTORS = {
  format: v => v,
  unformat: v => v,
  children: {
    name: {
      format: v => v,
      unformat: v => v,
    },
    // 'job' is intentionally left out...
    stats: {
      format: v => v,
      unformat: v => v,
      children: {
        attack: {
          format: v => v,
          unformat: v => v,
        },
        evasion: {
          format: v => v,
          unformat: v => v,
        },
        speed: {
          format: v => v,
          unformat: v => v,
        },
        attributes: {
          format: v => v,
          unformat: v => v,
          children: {
            level: {
              format: v => v,
              unformat: v => v,
            },
            experience: {
              format: v => v,
              unformat: v => v,
            },
          },
        },
      },
    },
    ailments: {
      format: v => v,
      unformat: v => v,
      children: {
        $: {
          format: v => v,
          unformat: v => v,
        },
      },
    },
    items: {
      format: v => v,
      unformat: v => v,
      children: {
        $: {
          format: v => v,
          unformat: v => v,
          children: {
            id: {
              format: v => v,
              unformat: v => v,
            },
            rate: {
              format: v => v,
              unformat: v => v,
            },
          },
        },
      },
    },
    triangles: {
      format: v => v,
      unformat: v => v,
      children: {
        $: {
          format: v => v,
          unformat: v => v,
          children: {
            $: {
              format: v => v,
              unformat: v => v,
            },
          },
        },
      },
    },
  }
}

export const ITEMS_MODEL = [
  { id: '', name: '' },
]

export const ITEMS_SELECTORS = {
  genItem: () => ({ id: '', name: '' }),
  format: v => v,
  unformat: v => v,
  children: {
    $: {
      format: v => v,
      unformat: v => v,
      children: {
        id: {
          format: v => v,
          unformat: v => v,
        },
        name: {
          format: v => v,
          unformat: v => v,
        },
      },
    },
  },
}

export function capitalize (str) {
  return `${str.charAt(0).toUpperCase()}${str.slice(1)}`
}

export function toNumeric (str, allowDecimal = false) {
  return str.replace(allowDecimal ? /\$|,/g : /\D/g, '')
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

  const offset = model.period === PERIOD.PM ? 12 : 0

  return model.hours + (model.minutes / 60) + offset
}

export function timeToScalar (time) {
  const periodToMinutes =
    time.period === PERIOD.PM && time.hours !== 12 ? 720 : 0

  return periodToMinutes + (time.hours * 60) + (time.minutes)
}

export const passValidator = {
  error: '',
  validator: () => true,
}

export const failValidator = {
  error: 'asdf',
  validate: () => false,
}

export const phoneNumberValidator = {
  error: 'Invalid phone number',
  validate: v => !v || pkg.isMobilePhone(v),
}

export const segmentValidator = {
  error: 'Conflicting Time',
  validate: (v, keyPath, state) => {
    const key = keyPath[keyPath.length - 1]
    const otherKey = key === 'start' ? 'end' : 'start'
    const durationPath = keyPath.slice(0, keyPath.length - 1)
    const otherPath = [...durationPath, otherKey]
    const minutes = timeToScalar(v)
    const otherMinutes = timeToScalar(getValueByPath(state, otherPath))

    return key === 'start' ? (minutes < otherMinutes) : (minutes > otherMinutes)
  },
}

export const intervalValidator = {
  error: 'Intersecting Interval',
  validate: (v, keyPath, state) => {
    const key = keyPath[keyPath.length - 1]
    const otherKey = key === 'start' ? 'end' : 'start'
    const segmentPath = keyPath.slice(0, keyPath.length - 1)
    const segmentIndex = Number(segmentPath[segmentPath.length - 1])
    const offset = key === 'start' ? -1 : 1
    const otherIndex = segmentIndex + offset
    const itemsPath = keyPath.slice(0, keyPath.length - 2)
    const items = getValueByPath(state, itemsPath)

    if (otherIndex < 0 || otherIndex > items.length - 1) {
      return true
    }

    const otherPath = [...itemsPath, `${otherIndex}`, otherKey]
    const minutes = timeToScalar(v)
    const otherMinutes = timeToScalar(getValueByPath(state, otherPath))

    return key === 'start' ? (minutes > otherMinutes) : (minutes < otherMinutes)
  },
}
