# @zensen/form-service

A reactive form service framework

## Features

- Facilitates form state
- Triggers efficient re-renders for reactive components
- Keeps track of state dirtiness
- Handles complex data structures
- Provides a validation framework

This was created as a form solution for `LitElement`, but it can work with other reactive component packages such as `React`.

## Install

Using `npm`:

```
$ npm install @zensen/form-service
```

Using `yarn`:

```
$ yarn add @zensen/form-service
```

## API

### Initialization

The `FormService` is an ES6 class, so it can be instantiated via constructor.

```js
import { FormService } from '@zensen/form-service'

const MODEL = {}

const SELECTORS = {}

const onChange = (dirty, state, errors) => {
  console.info('dirty:', dirty)
  console.info('state:', state)
  console.info('errors:', errors)
}

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Arguments: 
- `model`: input data model that represents the form state
- `selectors`: selectors map are configurable behaviors that are invoked on different keys.
- `onChange`: callback that is invoked whenever the form's state is changed.

### The Input Model

The data model should represent the form's state in a more portable format that is agnostic to any particular UI requirements. The response payload to API requests commonly act as the input model.

A deep copy of the input model is made when passed to `FormService`'s constructor, and used as its internal state that it.

During this process, selectors may be invoked on keys to transform the copied data into a format that is consumable for your web components.

_NOTE_: The input data model is never mutated.

A common example of this is when a form key property with a value of type `Number` in the model will be represented as a value in a textfield.

The textfield will want to manipulate it as a string:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumeric } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  children: {
    price: {
      format: v => toCurrency(v),
      unformat: v => toNumeric(v),
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

The `onChange()` callback is invoked after initialization, and yields the following `state`:

Here's the following output:

```console
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}
```

The `FormService` copied the `id` and `name` keys over as-in, but the `price` was changed from a `Number` type to a `String` with additional formatting.

Arrays are allowed as well:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumeric } from './formatters'

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
          unformat: v => v.split(' ')[0],
        },
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

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

### Selectors and Modifiers

Selectors are metadata that can be associated with certain keys in `FormService`'s state to give them special properties for formating to and from model/state and validation. These selectors are objects that contain a set of _modifiers_ that describe certain properties about that model/state key.

In the example above, a set of formatter modifiers are applied to `state.price`. Note that the `SELECTORS` object doesn't directly contain the `price` property like the model/state does. Instead, it's wrapped in a `children` block because `price` is a _child_ property to the root, in this case. This way _modifiers_ can be applied to the parent object, and there's no namespace collision between modifier names such as `format`, `unformat`, `validators`, etc and your model/state's key names.

As implied, this means that modifiers can be applied to the entire model/state by defining them at the root of of the selectors object:

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  id: '',
  username: 'SomeOne@iUsedToKnow.com',
  password: 'asdf',
}

const SELECTORS = {
  format: v => ({
    id: v.id || '123',
    username: v.username.toLowerCase(),
    password: 'gotem',
  }),
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

Here's the output:

```console
state: {
  id: '123',
  username: 'someone@iusedtoknow.com',
  password: 'gotem',
}
```

Selectors can be defined on child keys of sub-objects by defining the `children` property on the parent selector:

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  name: 'Some one',
  phone: {
    number: '8005551234',
    type: 'work',
  },
}

const SELECTORS = {
  children: {
    phone: {
      children: {
        number: {
          format: v => toPhoneNumber(v),
          unformat: v => toNumeric(v),
        },
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
const result = formService.buildModel()

console.log('result:', result)
```

Here's the result:

```js
state: {
  name: 'Some one',
  phone: {
    number: '(800) 555-1234',
    type: 'work',
  },
}

result: {
  name: 'Some one',
  phone: {
    number: '8005551234',
    type: 'work',
  },
}
```

Selectors can be applied to array elements via the `$` wildcard selector:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumeric } from './formatters'

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
          unformat: v => v.split(' ')[0],
        },
      },
    },
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)
```

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

In the case of formatting, it's applied to all elements.

### Exporting State with `buildModel()`

Once the form has been modified and is ready for submission, it's a common need to convert parts of the form from UI-state back to a more agnostic data model for submitting to an API or long-term storage. This method creates a new `model` by making a deep copy of `state`, executing any `unformat` modifiers that are defined on selectors.

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumber } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  price: {
    format: v => toCurrency(v),
    unformat: v => toNumber(v),
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS, onChange)

const result = formService.buildModel()
console.log('result:', result)
```

```console
state: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: '$4.00',
}

result: {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}
```

The `FormService` copied over its state as usual by formatting the `price` key to a currency-formatted string, and the model that was returned provided the `price` key's value as a `Number` as a result of `unformat()` being defined on its selector.

_NOTE_: It's a best practice to always provide selectors with `unformat()` alongside with `format()` and vice-versa to maintain data-context consistency.

### Modifying State with `apply()`

This method is used to make changes to the form's state that deviate from its initial state. This is generally called as a result of a web component changing due to user interaction:

```js
import { FormService } from '@zensen/form-service'

const MODEL = [
  enabled: true,
  week: [
    {
      day: 'Monday',
      segments: [
        {
          start: { hours: 8, minutes: 0, period: 'AM' },
          end: { hours: 12, minutes: 0, period: 'PM' },
        },
        {
          start: { hours: 1, minutes: 0, period: 'PM' },
          end: { hours: 5, minutes: 0, period: 'PM' },
        },
      ],
    },
    {
      day: 'Wednesday',
      segments: [
        {
          start: { hours: 8, minutes: 0, period: 'AM' },
          end: { hours: 12, minutes: 0, period: 'PM' },
        },
      ],
    },
  ],
]

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('enabled', false)
formService.apply('week.0.segments.1.start.hours', 9)
formService.apply('week.1.day', 'Thursday')
```

```console
state: [
  enabled: false,
  week: [
    {
      day: 'Monday',
      segments: [
        {
          start: { hours: 9, minutes: 0, period: 'AM' },
          end: { hours: 12, minutes: 0, period: 'PM' },
        },
        {
          start: { hours: 1, minutes: 0, period: 'PM' },
          end: { hours: 5, minutes: 0, period: 'PM' },
        },
      ],
    },
    {
      day: 'Thursday',
      segments: [
        {
          start: { hours: 8, minutes: 0, period: 'AM' },
          end: { hours: 12, minutes: 0, period: 'PM' },
        },
      ],
    },
  ],
]
```

#### Pristine Status

Each key in the state has its own pristine flag associated to it. When the state is first built, a `pristine` schema is built internally to match the shape of the state like so:

```js
/* pristine */ [
  enabled: true,
  week: [
    {
      day: true,
      segments: [
        {
          start: { hours: true, minutes: true, period: true },
          end: { hours: true, minutes: true, period: true },
        },
        {
          start: { hours: true, minutes: true, period: true },
          end: { hours: true, minutes: true, period: true },
        },
      ],
    },
    {
      day: true,
      segments: [
        {
          start: { hours: true, minutes: true, period: true },
          end: { hours: true, minutes: true, period: true },
        },
      ],
    },
  ],
]
```

Pristine flags are generated for each leaf-most key by default. Pristine flags are meant to line up with keys in the state that are associated with input components in the UI. Pristine is set to `false` once `apply()` has been called on that key.

There will be cases where an input component will take an object-type key as input instead of a leaf-like value such as a `Boolean`, `Number`, or `String`. Common examples are select/dropdowns and date pickers. If these components call `apply()` on a key where its corresponding pristine key is an object instead of a boolean flag, then an error will be thrown. To remedy this, the `clipPristine` modifier can be set to `true` for that key's selector:

```js
const SELECTORS = {
  children: {
    week: {
      children: {
        $: {
          children: {
            segments: {
              $: {
                children: {
                  start: { clipPristine: true },
                  end: { clipPristine: true },
                },
              },
            },
          },
        },
      },
    },
  },
}
```

#### Restrictions

- Only a single key can ever be modified along its branch in the `state` tree
- `apply()` cannot be applied to object-type keys unless `clipPristine` is set on that key's selector
- Objects that can be modified must not alter the shape of that schema with the exception of going between null/object states
- The `unsafe` modifier flag can be set on keys in exceptional cases (such as multi-selects) where object/array mutations are required

### Adding an Item to an Array with `addItem()`

Arrays are a bit special when it comes to state mutations because it's commonplace to modify its size as a result of form actions.

The `addItem(path, index = -1)` method can be called on a key-path to an array in the state. The index is an optional parameter for cases where the new item should be inserting within the array, otherwise it will be inserted at the end of the array. The `createItem` modifier must be defined that array key's selector:

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

The data returned by `createItem()` must be in the model format as `FormService` will execute any relevant formatters against it.

`createItem()` can also return primitive types as well as objects and arrays of any complexity. Just make sure that their data structures match the general data structure of each element.

### Removing an Item from an Array with `removeItem()`

`FormService` also provides a `removeItem(path, index = -1)` method for removing items. Just like `addItem()`, the `index` argument is optional. It will remove the last item in the array by default if not provided.

### Moving an Item in an Array with `moveItem()`

A single item can be moved within an array by calling `moveItem(path, toIndex, fromIndex)`.

### Swapping Items in an Array with `swapItems()`

Two items can be swapped within an array by calling `swapItem(path, index1, index2)`.

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

This is done to guarantee re-renders for reactive component libraries such as `LitElement` and `React` at every level. This is ideal for cases where the project has wrapper components that group input field components together for higher reusability.

For example: it might make sense for the project to have a _name-group_ component which takes a `name` object as a renderable prop containing `first` and `last` keys which it assigns to its own child components textfields components.

If `this.__state.name` wasn't re-assigned, then the _name-group_ component wouldn't re-render. If `this.__state` wasn't re-assigned, then the form component itself wouldn't re-render. Both re-assignments are required to sync the UI with `FormService`'s state.

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

### Updating State from Model with `refresh()`

Sometimes the input model changes due to outside circumstances.

A common example is when an updated version of the model has been returned from an API request, and now `FormService` must be reinitialized. The `refresh()` method does just that:

```js
const onResponse => model => formService.refresh(model)
```

This will build a new state, resetting dirtiness-status, unsetting all errors, and pristineness.

### Reverting State with `reset()`

This method current state of `FormService` needs to be reverted back to its initial state, then `reset()`.

```js
const onCancel => () => formService.reset()
```

This also resets dirtiness status.

### Using Validators

One of the most powerful feature of `FormService` is its validation framework. It's surprisingly simple, yet has a lot of depth when you need it. It's as complex as your project requires.

Validators are applied to selectors like so:

```js
import { FormService } from '@zensen/form-service'

const MODEL = {
  phone: { number: '', type: '' },
}

const SELECTOR = {
  children: {
    email: [isEmail],
    phone: {
      children: {
        number: {
          format: v => toPhoneNumber(v),
          unformat: v => toNumeric(v),
          validators: [isPhoneNumber],
        },
      },
    },
  },
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTOR, onChange)
```

The `validators` modifier has been added to the selectors for the `email` and `phone.number` keys. The `validators` modifier is always an array, and they can be applied directly to the key as a form of short-hand if they're the only modifier associated with that key as seen with the `email` key above.

```js
formService.apply('email', 'asdf')
formService.apply('phone.number', 'asdf')
```

Validation is invoked on the key whenever a new value is directly applied to it or one of its descendent keys as long as it doesn't have pristine status. When this happens, each validator is invoked in the order they're placed in the array, and the loop will break upon the first failed validation, assigning an error to that previous key.

Also notice that selectors that only need the `validators` key can just assign an array of validators to the selector key as a form of shorthand instead of declaring a sub-object with a `validators` property.

Let's look at the console output:

```console
// initialized
errors: {
  email: '',
  phone: { number: '', type: '' },
}

// when incorrect email format is applied
errors: {
  email: 'Invalid email',
  phone: { number: '', type: '' },
}

// when an invalid phone number is applied
errors: {
  email: '',
  phone: { number: 'Invalid phone number', type: '' },
}
```

### Creating Validators

A validator is merely an object with an `error` key and a `validator` key:

```js
const required = {
  error: '',
  validate: v => v || (Array.isArray(v) && v.length),
}
```

However, it's a best practice to make the validator a function that returns an instantiated object. This makes the validator configurable for things like its `error`, which could be useful for highly-reusable validators.

```js
function required (error) {
  return {
    error,
    validate: v => v || (Array.isArray(v) && v.length),
  }
}
```

These functions are known as _validator creators_ as this pattern was inspired by `redux`'s action/action creator pattern.

_NOTE_: Validators should generally only evaluate a single point of failure.

The `error` property is generally a string, but it's also common to use `Boolean` values in cases where the components that consume them don't need/take an error message.

### Advanced Validators

Up until now, we've only seen the `validate` function define a single parameter, `v`, but it actually has more data passed to it. The full signature of this function looks like this:

```js
validate(value, keyPath, state, service)
```

We're already familiar with `value`, so let's go to the next one: `keyPath`. This value is the path in the state to the key that is being validated. This is a typical key path, except broken up as an array. For example:

This: `phone.number` would be returned as this: `['phone', 'number']`.

The array-path is used for convenience for making it slightly easier to generate paths relative to the one supplied. In addition to this, the entire form's `state` is passed as the last parameter.

With these two parameters, it is easy to look up the values of nearby keys. This can be really useful for validators for keys to objects in the form's state.

Finally, we have the `service` parameter. This is the instance of the `FormService` that invoked this validator. This is useful in cases where we might want to validate other keys as a result of this one being invoked.

## Modifiers

- `unsafe`: flag for object-type keys which will ignore integrity checks when mutating entire objects (useful for replacing arrays)
- `clipPristine`: flag for object-type keys which will clip its corresponding key in the `pristine` schema to a single value
- `ignorePristine`: removes pristine status from a key

- `createItem`: function that generates a new array item for that selector
- `format`: transforms the affect's key's value coming from the input model
- `unformat`: transforms the affect's key's value coming from the state
- `validators`: an array of validators that can be invoked against the current value of the key
- `children`: used to define child-selectors
