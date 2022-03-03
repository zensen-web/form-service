---
layout: default
title: Mutating Key Data
permalink: /guide/mutating-key-data/
parent: Guide
nav_order: 4
---

# Mutating Data

## apply(path, value)

Once `FormService` has been populated with formatted data, it can be manipulated in a variety of ways. This method is used to make changes to the form's state that deviate from its initial state. This is generally called as a result of a web component changing due to user interaction.

### A Simple Example

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  firstName: '',
  lastName: '',
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('firstName', 'Tony')
```

Output:

```console
state: {
  firstName: 'Tony',
  lastName: '',
}
```

### Mutating Data Inside of Sub-Objects

The `apply()` method can also set data within sub-objects:

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  firstName: '',
  lastName: '',
  stats: {
    strength: 3,
    defense: 0,
    evasion: 4,
    accuracy: 8,
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('stats.strength', 9001)
```

Output:

```console
state: {
  firstName: '',
  lastName: '',
  stats: {
    strength: 12,
    defense: 0,
    evasion: 4,
    accuracy: 8,
  },
}
```

### Mutating Data Within Arrays

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  firstName: '',
  lastName: '',
  phones: [
    {
      type: 'home',
      number: '7775551234',
    },
  ],
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('phones.0.type', 'work')
```

Output:

```console
state: {
  firstName: '',
  lastName: '',
  phones: [
    {
      type: 'work',
      number: '7775551234',
    },
  ],
}
```

Mutating data within an array element is no different than modifying a property within sub-objects. This might look a little weird that the bracket syntax is not used with arrays, but that's because JavaScript arrays are special-case objects (more on that later). An array index is really just a property key in the array object, and element itself is the value.

### Mutating Entire Objects

The previous examples mutated primitive keys with values that are `Boolean`, `Number`, and `String` types, but there hasn't been an example of mutating an object yet. That's because this operation isn't allowed by default.

Here's an example:

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  firstName: '',
  lastName: '',
  stats: {
    strength: 3,
    defense: 0,
    evasion: 4,
    accuracy: 8,
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

/* this will cause an error */
formService.apply('stats', {
    strength: 255,
    defense: 255,
    evasion: 255,
    accuracy: 255,
})
```

This results in an error because of `FormService`'s pristineness mechanisms for tracking which keys have been touched before.

### Pristine Status

Each key in the state has its own pristine flag associated to it that `FormService` uses to determine whether or not validation can be invoked on key (more on that [later](#)).

When the state is first built, a `pristine` schema is built internally to match the shape of the state.

```js
/* state */

{
  firstName: '',
  lastName: '',
  phones: [
    {
      type: { // "type" is an object that is passed to a dropdown as its "value"
        id: 'home',
        label: 'Home',
      },
      number: '',
    },
  ],
}
```

```js
/* pristine */

{
  firstName: true,
  lastName: true,
  phones: [
    {
      type: {
        id: true,
        label: true,
      },
      number: true,
    },
  ],
}
```

Pristine flags are generated for each leaf-most key by default, however pristine flags are meant to line up with keys in the state that are associated with input components in the UI. Pristine is set to `false` once `apply()` has been called on that key. Due to this, `apply()` can only be called on keys that are represented as leaf-most keys in the `pristine` schema. Calling `apply()` on keys that are not leaf keys in the `pristine` schema will result in an error.

### Allowing Object Mutations

There will be cases where an input component will take an object-type key as input instead of a leaf-like value such as a `Boolean`, `Number`, or `String`. Common examples are select/dropdowns and date pickers. If these components call `apply()` on a key where its corresponding pristine key is an object instead of a boolean flag, then an error will be thrown. To remedy this, the `clipPristine` modifier can be set to `true` for that key's selector:

```js
const SELECTORS = {
  children: {
    phones: {
      children: {
        $: {
          children: {
            type: { clipPristine: true },
          },
        },
      },
    },
  },
}
```

This results in the following pristine schema:

```js
/* pristine */

{
  firstName: true,
  lastName: true,
  phones: [
    {
      type: true, // this was an object in the previous example
      number: true,
    },
  ],
}
```

The `type` pristine key is now a leaf value in the pristine schema instead of a branch like in the previous example due to `clipPristine` being set. This allows `FormService` to invoke `apply()` on the `type` key within its state.

_NOTE_: This only allows the object to be replaced with a new object of the same shape. `FormService` will throw an error if the new object has a different shape unless the `unsafe` modifier is also provided on the selector. This should only be done in very specific situations, and should be avoided normally.

### Restrictions

Here is a recap of the following restrictions:

- Only a single key can ever be modified along its branch in the `state` tree
- `apply()` cannot be applied to object-type keys unless `clipPristine` is set on that key's selector
- Objects that can be modified must not alter the shape of that schema with the exception of going between null/object states
- The `unsafe` modifier flag can be set on keys in exceptional cases (such as multi-selects) where object/array mutations are required

These restrictions are also important because it helps constrain form data into consistent shapes. This is helpful because it helps us avoid common errors.

### Cascading Re-renders Guaranteed

All mutation operations also invokes a shallow copy against the parent key, and all ancestor keys of the key that was modified from the deepest level upward.

Here's a simplified illustration of how the ancestor keys are updated under-the-hood when modifying the key for:

`week.0.segments.1.start.hours`

```js
this.__state.week[0].segments[1].start.hours = 9
this.__state.week[0].segments[1].start = { ...this.__state.week[0].segments[1].start }
this.__state.week[0].segments[1] = { ...this.__state.week[0].segments[1] }
this.__state.week[0].segments = [ ...this.__state.week[0].segments ]
this.__state.week[0] = { ...this.__state.week[0] }
this.__state.week = [ ...this.__state.week ]
this.__state = { ...this.__state }
```

### Dirtiness

`FormService` keeps a copy of the initial state of the form. Whenever changes are made to the form's current state, it's compared against this intial state to determine whether or not it's _dirty_.

For example, given the scenario:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumber } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  children: {
    price: {
      format: v => toCurrency(v),
      unformat: v => toNumber(v),
    },
  },
}

const onChange = (dirty, state) => console.log('dirty:', dirty, 'state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Here is the initial output:

```console
dirty: false,
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}
```

Then, let's apply a change to dirtiness:

```js
formService.apply('name', 'Craft Beer')
```

Yields the following output:

```console
dirty: true,
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Craft Beer',
  price: '$4.00',
}
```

We can manually revert dirtiness by apply another change to make the state match its initial state like so:

```js
formService.apply('name', 'Beer')
```

```console
dirty: false,
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}
```

## addItem(path, index = -1)

`FormService` doesn't like its shape to be changed by default because its state needs to stay in sync with the `pristine` schema. Arrays are a special type of object in which each element is just a key, therefore adding or removing elements in the array is really no different than adding or removing keys to an object. Arrays are a bit special when it comes to state mutations because it's commonplace to modify its size as a result of form actions.

The `addItem()` method can be called on a key-path to an array in the state. The `index` parameter is optional parameter for cases where the new item should be inserting within the array. Otherwise, the new element will be inserted at the end of the array if not provided. The `createItem()` modifier must be defined that array key's selector.

### Example

```js
const MODEL = [
  {
    id: '123',
    name: 'Apples',
    price: 329, // cents
  },
  {
    id: '456',
    name: 'Oranges',
    price: 499, // cents
  },
]

const SELECTORS = {
  products: {
    createItem: () => ({
      id: '',
      name: '',
      price: 0,
    }),
    children: {
      price: {
        format: v => toCurrency(v),
        unformat: v => toNumeric(v, false), // false = strip decimal
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)

formService.addItem('') // empty path will apply to the root

console.log('state:', state)
```

Output:

```console
state: [
  {
    id: '123',
    name: 'Apples',
    price: '$3.29',
  },
  {
    id: '456',
    name: 'Oranges',
    price: '$4.99',
  },
  {
    id: '',
    name: '',
    price: '$0.00',
  },
]
```

### createItem(keyPath, index, model, service)

The data returned by `createItem()` must be in the same shape as its expected in the input data model because `FormService` will execute any relevant formatters against it.

`createItem()` can also return primitive types as well as objects and arrays of any complexity. Just make sure that their data structures match the general data structure of each element.

## removeItem(path, index = -1)

`FormService` also provides the `removeItem()` method for removing items. Just like `addItem()`, the `index` argument is optional. It will remove the last item in the array by default if not provided.

## moveItem(path, fromIndex, toIndex)

A single item can be moved within an array by calling `moveItem(path, toIndex, fromIndex)`.

## swapItems(path, index1, index2)

Two items can be swapped within an array by calling `swapItem(path, index1, index2)`.
