# CHANGELOG

## v1.1

- Added `moveItem()` for easily moving an item to another spot in an array
- Added `swapItem()` for easily swapping two items in an array

## v2

### Selector Access to Top-Level Properties is Consistent with Sub-Level Properties

Previously, selectors accessed top-level properties were pretty direct in previous versions.

Take this model for example:

```js
const MODEL = {
  email: 'john@doe.io',
  name: {
    first: 'John',
    last: 'Doe',
  },
}
```

In previous versions of `FormService`, selectors could be defined for top-level properties such as `email` like this:

```js
const SELECTORS = {
  email: [isEmail],
  name: [required],
}
```

Then, sub-object properties were accessed via the `children` sub-selector:

```js
const SELECTORS = {
  email: [isEmail],
  name: {
    children: {
      first: [required],
      last: [required],
    },
  },
}
```

The `children` sub-selector was created to eliminate any potential any chance of reserved words. For example, if the `children` sub-selector didn't exist, and the data had a properties named `clipErrors` or `validators`, then `FormService` would process them as modifiers instead of as selectors. The top-level object in a `model` was treated special in the sense that it couldn't have modifiers applied to it such as `clipErrors`, `validators`, etc. This limited its use.

This has now been changed as `children` is always required to access top-level properties going forward:

```js
const SELECTORS = {
  children: {
    email: [isEmail],
    name: [required],
  },
}
```

Although this is a bit more verbose, the consistent behavior allows us to write selectors for the entire object:

```js
const SELECTORS = {
  format: v => v, // format entire schema at the top-level
  unformat: v => v, // format entire schema at the top-level
  validators: [], // top-level validation
  children: {
    email: [isEmail],
    name: [required],
  },
}
```

This also allows the root object of the schema to be an array going forward:

```js
const MODEL = [
  {
    id: '1',
    hp: 520,
    name: 'Tidus',
  },
  {
    id: '2',
    hp: 1030,
    name: 'Auron',
  },
  {
    id: '3',
    hp: 475,
    name: 'Yuna',
  },
]
```

```js
const SELECTORS = {
  format: v => v, // format the entire array
  unformat: v => v, // unformat the entire array
  $: {
    format: v => v, // format each array element
    unformat: v => v, // unformat each array element
  },
}
```

# Clearer Syntax for Declaring Selectors for Array Elements

- Also supports nested arrays

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

- Renamed `genItem()` to `createItem()`
- Changed `createItem()` to return data in the model-form as `FormService` will convert it to state
- Remove `clipErrors` as the existence of `validators` will clip them going forward
- `validators` can be applied to a selector as long as none of their ancestor selectors apply `validators`
- Added `validateRaw` to unformat value
- Added `validateManually`
- Throw an error if `validators` is defined on selectors with parent selectors that also define `validators`
- Throw an error if calling `apply()` on a key where `pristine` is type `object`
- Validation workflow with `apply()`:
  - Execute if key has `validators`
  - Execute `validators` on any parent keys that have them
- `unsafe` modifier to disable certain safety checks

## v2.1 (Pre-Release)

- `createItem()` will pass parameters like so: `createItem(path, index, state, service, opts)`
