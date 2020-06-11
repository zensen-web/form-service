- Added `moveItem()` for easily moving an item to another spot in an array
- Added `swapItem()` for easily swapping two items in an array

- Selectors can now be declared for arrays and on a per-element-basis:

```js
const MODEL = {
  emails: [
    'no.one@zensen.io',
    'some.one@zensen.io',
  ],
  phones: [
    { number: '+1 (702) 555-1234', type: 'Home' },
    { number: '+1 (702) 555-5678', type: 'Work' },
    { number: '+1 (702) 699-3030', type: 'Dominos Pizza' },
  ],
  triangles: [
    [0, 1, 2],
    [0, 2, 3],
  ],
}

const SELECTORS = {
  emails: {
    format: v => v, // formats model.emails
    unformat: v => v,
    children {
      $: {
        format: v => v, // formats model.emails[$]
        unformat: v => v,
      },
    },
  },
  phones: {
    format: v => v, // formats model.phones
    unformat: v => v,
    children {
      $: {
        format: v => v, // formats model.phones[$]
        unformat: v => v,
        children: {
          number: {
            format: v => v, // formats model.phones[$].number
            unformat: v => v,
          },
          type: {
            format: v => v, // formats model.phones[$].type
            unformat: v => v,
          },
        },
      }
    },
  },
  triangles: {
    format: v => v, // formats model.triangles
    unformat: v => v,
    children: {
      $: {
        format: v => v, // formats model.triangles[$]
        unformat: v => v,
        children: {
          $: {
            format: v => v, // formats model.triangles[$][$]
            unformat: v => v,
            children: {
            },
          },
        },
      },
    },
  },
}
```

- Nested arrays are supported

- Changed `genItem()` to return data in the model-form as FormService will convert it to state
- Remove `clipErrors` as the existence of `validators` will clip them going forward
- `validators` can be applied to a selector as long as none of their ancestor selectors apply `validators`
- Throw an error if `validators` is defined on selectors with parent selectors that also define `validators`
- Throw an error if calling `apply()` on a key where `pristine` is type `object`
- Validation workflow with `apply()`:
  - Execute if key has `validators`
  - Execute `validators` on any parent keys that have them
