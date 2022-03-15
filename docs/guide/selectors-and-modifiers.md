---
layout: default
title: Selectors and Modifiers
permalink: /guide/selectors-and-modifiers/
parent: Guide
nav_order: 2
---

# Selectors and Modifiers

Form data is manipulated by modifiers and mutation actions. There are several different types of modifiers, which will be covered in future sections.

But first, let's discuss selectors.

## Selectors

A selector is a group of different types of modifier definitions that target a specific key in the form's state. A selector is represented as an object where each of its properties are named after the different possible modifiers:

```js
const SELECTOR_GIL = {
  format: v => `${v} Gil`,
  unformat: v => Number(v.split(' ')[0]),
}
```

In the example above, that selector defines two modifiers: `format()` and `unformat()`. These modifiers will be covered in detail in the following sections.

Next, we need to apply this selector to a key in the form's data. This is done by assigning the selector object to a corresponding data key in the selectors map object that's passed into `FormService`.

## Selecting Top-Level Keys

```js
import FormService from '@zensen/form-service'

const MODEL = {
  id: '378625d6-8bff-4750-bdd8-a3ac4cfb0d6c',
  name: 'Goblin',
  gil: 10,
}

const SELECTORS = {
  children: {
    gil: SELECTOR_GIL,
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

In this example, the input data model has three keys: `id`, `name`, and `gil`. A selector for the `gil` key has been defined in the `SELECTORS` map object, and the `format()` and `unformat()` modifiers defined on it.

Note that our `gil` selector object property is nested underneath an object called `children` instead of directly as a property to the selectors map object. This is because the larger selectors map object _is_ a selector. In other words, we can apply modifiers directly to the entire form data object if we wanted to.

Here's an example:

```js
const MODEL = {
  id: '378625d6-8bff-4750-bdd8-a3ac4cfb0d6c',
  name: 'Goblin',
  gil: 10,
}

const SELECTORS = {
  format: v => { // applied to the entire state object
    return {
      id: v.id,
      name: v.name,
      gil: `${v.gil} Gil`,
    }
  },
  unformat: v => { // applied to the entire state object
    return {
      id: v.id,
      name: v.name,
      gil: Number(v.split(' ')[0]),
    }
  },
}
```

## Selecting Sub-Object Keys

As alluded to above, all selectors to top-level keys are really sub-selectors to the root selector that runs against the entire form's state, but we aren't just limited to writing selectors for the entire state and top-level keys though. We can write selectors for the deepest keys in our form's data structure using the `children` modifier.

```js
const MODEL = { // A.
  id: '378625d6-8bff-4750-bdd8-a3ac4cfb0d6c',
  name: 'Goblin',
  drop: { // B.
    commonItemId: '8d82989b-f6fe-4bbc-8c1c-b5ec3d4f09ec',
    rareItemId: '38e803c8-ac06-4582-8b96-776ec878372c',
    gil: 10, // C.
  },
}

const SELECTORS = { // A. define the root selector
  children: { // access the entire state's children
    drop: { // B. define a selector for top-level "drop" key
      children: { // access sub-keys within the "drop" key in the form's state
        gil: { // C. define a selector for the "gil" key contained with the "drop" key
          format: v => `${v} Gil`,
          unformat: v => Number(v.split(' ')[0]),
        },
      },
    },
  },
}
```

## Selecting Array Elements

`FormService` isn't just limited to general object types. It can select data keys that are array elements or even sub-properties within those elements, but we need a _special_ type of selector to do so. This is where the `$` (wildcard) selector comes in.


```js
import FormService from '@zensen/form-service'
import { isEmailAddress } from '@zensen/form-validators'

import { toPhoneNumber, fromPhoneNumber } from './formatters'

const ITEMS = [
  {
    id: '3635570c-bf80-48c2-9318-f9681cfb7a76',
    name: 'Short Sword',
    price: 500,
  },
]

const MODEL = { // A.
  id: '378625d6-8bff-4750-bdd8-a3ac4cfb0d6c',
  firstName: 'Tony',
  lastName: 'Stark',
  emails: [ // B.
    'tstark@starkindustries.com', // C.
    'tonystark@avengers.org', // C.
    'tonystank@captamericahq.io', // C.
  ],
  phones: [ // D.
    { // E.
      type: 'home', // F.
      number: '7775551234', // G.
    },
    { // E.
      type: 'work', // F.
      number: '8883335678', // G.
    },
  ],
}

const SELECTORS = { // A. define the root selector
  children: { // access the entire state's children
    emails: { // B. define a selector for top-level "emails" key (array)
      children: { // access sub-keys (array elements) within the "emails" key in the form's state
        $: { // C. define an "element" selector for top-level "emails" key
          validators: [isEmailAddress()], // modifier
        },
      },
    },
    phones: { // D. define a selector for top-level "phones" key (array)
      children: { // access sub-keys (array elements) within the "phones" key in the form's state
        $: { // E. define an "element" selector for top-level "phones" key
          children: { // access sub-keys within the "element" key in the form's state
            number: { // G. define a selector for the "number" key contained within the "element" key
              format: v => toPhoneNumber(v), // modifier
              unformrat: v => fromPhoneNumber(v), // modifier
            },
          },
        },
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

The `$` key is just a placeholder for the actual index of an array element since array indexes are all unique. As one might guess, `FormService` applies all the configured modifiers to all array elements, so it's recommended that all array elements are all either the same primitive type, or that each element follows a similar shape if the form is working with an array of objects (or an array of arrays!).

As seen above, our form's state and our selectors structure is starting to get pretty complex, and the data structure is starting to get a bit deep as a result. There will be some recipes coming soon that will demonstrate some patterns that projects can utilize to break complex data structures down into more composable, reusable pieces.

## Primitive Model

It's also possible for the form's state to be represented by a single primitive type such as `boolean`, `number`, or `string`.

```js
import FormService from '@zensen/form-service'

const MODEL = 100000

const SELECTORS = {
  format: v => `${v} Gil`,
  unformat: v => Number(v.split(' ')[0]),
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```
