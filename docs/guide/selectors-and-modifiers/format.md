---
layout: default
title: "format()"
permalink: /selectors-and-modifiers/format/
parent: Selectors and Modifiers
grand_parent: Guide
nav_order: 1
---

# format(value, keyPath, model)

The input data model should represent the form's state in a more portable format that is agnostic to any particular UI requirements. The response payload to API requests commonly act as the input model. `FormService` makes a deep copy of the input data model that is passed into its constructor, and uses that new copy as the form's UI state. The input object representing the data model will never be modified as a result.

Selectors that define the `format()` modifier will be invoked on the original key's value during the deep copy process, and the output value of `format()` will be used in the copy instead. This gives us a chance to convert our UI-agnostic data model into a format that is more consumable by our particular UI components.

## A Simple Example

Let's say the input data model contains a property called `amount` that is a `Number` type, and we intend to represent that property in our form with a textfield component. The textfield component takes a string. We can create a selector for the `quantity` key, and use the `format()` modifier to convert the value to a string:

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  quantity: 4,
}

const SELECTORS = {
  children: {
    quantity: {
      format: v => `${v}`,
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Output:

```console
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  quantity: '4',
}
```

`FormService` copied the `id` and `name` keys over from the input model to UI state as-in, but the `quantity` was changed from a `Number` type to a `String` type.

It's a common convention to provide price information as penny-amounts via the API, but we'll probably want to represent those values as currency-formatted strings to our textfields:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b328',
  name: 'Car',
  price: 3500000, // value is in pennies, so 100 = $1
}

const SELECTORS = {
  children: {
    price: {
      format: v => toCurrency(v),
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Output:

```terminal
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b328',
  name: 'Car',
  price: '$35,000.00',
}
```

## Objects

It's also possible to format objects as well.

```js
import { FormService } from '@zensen/form-service'
import { toCurrency } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b328',
  name: 'Car',
  price: 3500000, // value is in pennies, so 100 = $1
}

const SELECTORS = {
  children: {
    price: {
      format: v => toCurrency(v),
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

## Arrays

Here's a more advanced example of formatting key data within an array.

```js
import { FormService } from '@zensen/form-service'
import { toCurrency } from './formatters'

const MODEL = [
  {
    id: '1',
    name: 'Potion',
    price: 200,
  },
  {
    id: '2',
    name: 'Hi-Potion',
    price: 1000,
  },
  {
    id: '3',
    name: 'Phoenix Down',
    price: 500,
  },
]

const SELECTORS = {
  children: {
    $: {
      children: {
        price: {
          format: v => `${v} Gil`,
        },
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Output:

```console
state: [
  {
    id: '1',
    name: 'Potion',
    price: '200 Gil',
  },
  {
    id: '2',
    name: 'Hi-Potion',
    price: '1000 Gil',
  },
  {
    id: '3',
    name: 'Phoenix Down',
    price: '500 Gil',
  },
]
```

## Additional

The `format()` modifier has additional parameters aside from the initial `v` parameter. There's also `keyPath` and `model`:

- `keyPath`: An array-path to this value in the `model`

- `model`: The entire input model. This is useful if `format()` needs access to other data in the original input data model to format the current value.

Both `keyPath` and `model` typically work together to build a portable selector that can be attached at any level of the selector tree (see recipes coming soon).

## Nested Operations

It is possible to perform nested formatting, but it is not recommended due to the order-of-operations.

```js
const MODEL = {
  name: 'Tony',
  amount: 100000,
}

const SELECTORS = {
  format: (v, _keyPath, model) => { // 1.
    console.log('---- ROOT: format() ----')
    console.log('v:', v)
    console.log('model:', model)

    return {
      name: v.name,
      amount: v.amount / 100,
    }
  },
  children: {
    format: (v, keyPath, model) => { // 2.
      console.log(`---- ${keyPath.join('.')} format() ----`)
      console.log('v:', v)
      console.log('model:', model)

      return `${v} Gil`
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Output:

```console
---- ROOT: format() ----
v: 100000
model: {
  name: 'Tony',
  amount: 100000,
}
```

```console
---- amount: format() ----
INNER v: 100.00
model called from INNER formatter: {
  name: 'Tony',
  amount: 100000,
}
```

```console
state: {
  name: 'Tony',
  amount: '1000.00 Gil',
}
```

As demonstrated above, `format()` is invoked for both selectors, and in the following order:

1. First, the outer formatter run against the entire model
2. Then, the inner formatter is run on the sub-key

Outer selectors are always processed first before their inner keys' selectors during formatting, so changes made to keys by outer formatters will be passed as input values to `format()` modifiers defined in inner selectors. This is why `100.00` was passed into `v` instead of `100000` when the inner selector's formatter was invoked. Despite changes in `v` across selectors, the input model that's passed into `format()` never changes because the original input data model is passed in.
