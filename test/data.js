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

export const ENEMY_SELECTORS = {
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
