# zensen-form-service

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
$ npm install @zensen/router
```

Using `yarn`:

```
$ yarn add @zensen/router
```

## API

### Initialization

The `FormService` is an ES6, so it can be instantiated via constructor.

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

_NOTE:_ The input data model is never mutated.

A common example of this is when a form key property with a value of type `Number` in the model will be represented as a value in a textfield.

The textfield will want to manipulate it as a string:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency } from './formatters'

const MODEL = {
  id: '2ea17eaf-e855-4887-8312-27f991a5b327',
  name: 'Beer',
  price: 4,
}

const SELECTORS = {
  price: {
    format: v => toCurrency(v),
  },
}

const onChange = (_dirty, state) => {
  console.log('state:', state)
}

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

### Exporting State with `buildModel()`

This method returns a new copy of the form's current state in an agnostic format. Selectors may be invoked on keys that define the `unformat()` property like so:

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

const onChange = (_dirty, state) => {
  console.log('state:', state)
}

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

_NOTE:_ It's a best practice to always provide selectors with `unformat()` alongside with `format()` and vice-versa to maintain data-context consistency.

### Changing State with `apply()`

This method is used to make changes to the form's state that deviate from its initial state. This is generally called as a result of a web component changing due to user interaction. Making changes is simple:

```js
import { FormService } from '@zensen/form-service'
import { toCurrency, toNumber } from './formatters'

const MODEL = {
  id: '6d415b5d-2b70-4dd5-b739-b76c4ff7c6ef',
  name: 'Tony Stark',
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, {}, onChange)

formService.apply('name', 'Anthony Stark')
```

```console
// state when initialized
state: {
  id: '6d415b5d-2b70-4dd5-b739-b76c4ff7c6ef',
  name: 'Tony Stark',
}

// state when change is applied
state: {
  id: '6d415b5d-2b70-4dd5-b739-b76c4ff7c6ef',
  name: 'Anthony Stark',
}
```

### Dirtiness

Another deep copy is performed on the state during initialization. This serves as an initial snapshot, so `FormService` can keep track of deviations in state when its state is manipulated.

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
  price: {
    format: v => toCurrency(v),
    unformat: v => toNumber(v),
  },
}

const onChange = (dirty, state) => {
  console.log('dirty:', dirty, 'state:', state)
}

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

We can apply another change to make the state match its initial state like so:

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

This will build a new state and reset any errors. It also rebuilds the initial state, so its dirtiness status is also reset.

### Reverting State with `reset()`

This method current state of `FormService` needs to be reverted back to its initial state, then `reset()`.

```js
const onCancel => () => formService.reset()
```

This also resets dirtiness status.

### Nested Selectors

Selectors can be defined on child keys of sub-objects by defining the `children` property on the parent selector:

```js
const MODEL = {
  name: 'Some one',
  phone: {
    number: '8005551234',
    type: 'work',
  },
}

const SELECTORS = {
  phone: {
    children: {
      number: {
        format: v => toPhoneNumber(v),
        unformat: v => toNumeric(v),
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

The `apply()` method can directly modify nested selectors as well via dot-syntax:

```js
formService.apply('phone.type', 'home')
```

```console
state: {
  name: 'Some one',
  phone: {
    number: '(800) 555-1234',
    type: 'home',
  },
}
```

`apply()` also invokes a shallow copy against the parent key, and all ancestor keys of the key that was modified from the deepest level upward.

Here's a simplified illustration of the previous call to `apply()` from above:

```js
this.__state.phone.type = 'home'
this.__state.phone = { ...this.__state.phone }
this.__state = { ...this.__state }
```

This is done to guarantee re-renders for reactive component libraries such as `LitElement` and `React` at every level. This is ideal for cases where the project has wrapper components that group input field components together for higher reusability.

For example: it might make sense for the project to have a _phone-item_ component which takes a phone object as a renderable prop containing `number` and `type` keys which it assigns to its own child components: a _textfield_ _select_ component respectively.

If `this.__state.phone` wasn't re-assigned, then the _phone-item_ component wouldn't re-render. If `this.__state` wasn't re-assigned, then the form component itself wouldn't re-render. Both re-assignments are required to sync the UI with `FormService`'s state.

### Using Validators

One of the most powerful feature of `FormService` is its validation framework. It's surprisingly simple, yet has a lot of depth when you need it. It's as complex as your project requires.

Validators are applied to selectors like so:

```js
const MODEL = {
  phone: { number: '', type: '' },
}

const SELECTOR = {
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
}

const onChange = (_dirty, _state, errors) => console.log('errors:', errors)

const formService = new FormService(MODEL, SELECTOR, onChange)

formService.apply('email', 'asdf')
formService.apply('phone.number', 'asdf')
```

The `validators` key has been added to the `email` and `phone.number` keys. The `validators` property is always an array.

Validation is invoked on the key whenever a new value is directly applied to it. When this happens, each validator is invoked in order, and the loop will break upon the first failed validation, and then update set the error.

Also notice that selectors that only need the `validators` key can just assign an array of validators to the selector key as a form of shorthand instead of declaring a sub-object with a `validators` property.

Let's look at the console output:

```console
// initialized
errors: {
  email: '',
  phone: { number: '', type: '' },
},

// when incorrect email format is applied
errors: {
  email: 'Invalid email',
  phone: { number: '', type: '' },
},

// when an invalid phone number is applied
errors: {
  email: '',
  phone: { number: 'Invalid phone number', type: '' },
},
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
validate(value, keyPath, state)
```

We're already familiar with `value`, so let's go to the next one: `keyPath`. This value is the path in the state to the key that is being validated. This is a typical key path, except broken up as an array. For example:

This: `phone.number` would be returned as this: `['phone', 'number']`.

The array-path is used for convenience for making it slightly easier to generate paths relative to the one supplied. In addition to this, the entire form's `state` is passed as the last parameter.

With these two parameters, it is easy to look up the values of nearby keys. This can be really useful for validators for keys to objects in the form's state.

### Validation Errors as Objects _Partially Implemented_

Errors can also objects like so:

```js
export function requiredIf (primaryKey, secondaryKey, error = 'Required') {
  return {
    error: { [secondaryKey]: error },
    validate: v => !v[primaryKey] || v[secondaryKey],
  }
}
```

This is useful when applying validators to object-type keys. In the example above, the all sub-keys in the `error` object are applied relative to the selector that this validator is applied to.

```js
const MODEL = {
  contact: {
    email: '',
    phone: { number: '', phone: '' },
  },
}

const SELECTOR = {
  contact: {
    children: {
      phones: [requiredIf('number', 'type')],
    },
  },
}
```

If the `number` key has a truthy value and `type` is falsy, then an error message will be set on `errors.contact.phones.type` because the validator is set on `errors.contact.phones`.

_NOTE_: When `error` is an object, each key in its path is applied to the relative key path of the `FormService`'s `errors` schema instead of outright replacing the current error object with validator's `error` object as this could lead to data loss and other undesirable side effects.

### Cascading Validators _Partially Implemented_

Another powerful feature of `FormService`'s validation framework are cascading validators. If the key being validated is part of a sub-object, then its parent selector's validators will be executed regardless of whether or not validation failed on the original child key. This is because these validators are being across the entire parent object. Once those validators are done, that selector's parent selector will executes its validators, if any, and so on and so forth until the root of the selector tree is reached.

This is a work-in-progress, but there will likely be more selector properties to control the span of validation execution to provide additional flexibility if needed.

Cascading currently only works well when executing up one level from the original key's validation. A better algorithm is currently being worked on.

### Working with Arrays

The `FormService` has array support as well.

Elements can be modified via the dot-syntax like so:

```js
const MODEL = {
  name: 'Thor',
  emails: [
    'todinson@avengers.io',
  ],
  phones: [
    { number: '8885551234', type: 'work' },
  ],
}

const onChange = () => {}

const formService = new FormService(MODEL, {})

formService.apply('emails.0', 'asdf@asdf.com')
formService.apply('emails.0', 'asdf@asdf.com')
```

The index is merely a key within the keypath given above.

Selectors can be applied to them as well:

```js
const genEmptyPhone = () => ({ number: '', type: '' })
const padArray = (arr, filler) => arr.length ? arr : [filler]
function filterEmpty = arr => arr.filter(item => (typeof item === 'object'
  ? Object.keys(item).every(key => item[key])
  : item))

const fixEmail = email => email.findIndex('@') === -1
  ? `${email}@avengers.io`
  : email

const SELECTORS = {
  email: {
    children: {
      format: v => fixEmail(v),
    },
  },
  phones: {
    format: v => padArray(v, genEmptyPhone()),
    unformat: v => filterEmpty(v),
    children: {
      number: {
        format: v => toPhoneNumber(v),
        unformat: v => toNumeric(v),
      },
    },
  },
}
```

Let's start with `phones`. This selector has `format()` and `unformat()` applied to it. These properties operate on the entire array as a single value.

`phones` also has a child selector: `number`. The `number` selector is applied to the array element's sub-keys. In the case of `format()` and `unformat()`, they are invoked on each element during model/state conversions.

The `email` selector is interesting because it applies the `format()` property to its `children` property. This will apply `format()` to the element itself instead of sub-properties since the elements discrete values instead of objects.

### Adding/Removing Items with `addItem()` and `removeItem()`

Arrays are a bit special when it comes to state mutations because it's commonplace to modify its size as a result of form actions.

The `genItem()` selector property must be defined on a selector that represents an array in the state. It doesn't take any parameters because it's meant to fill space, and define the item's shape in cases where the item is an object.

Then, the `addItem(name, index)` method is called to create a new item. The `name` parameter is the dot-notation path to the key in the state, and the `index` is an optional parameter that determines where the item should be inserted in the array. If no index is provided, the item will be added to the end of the array.

```js
const MODEL = {
  phones: [
    { number: '8888888888', type: 'fax' }
  ],
}

const SELECTORS = {
  phones: {
    genItem: () => ({ number: '', type: '' }),
  },
}

const onChange = (_dirty, state) => console.log('state:', state)

const formService = new FormService(MODEL, SELECTORS)

formService.addItem('phones')
formService.apply('phones.1', { number: '8005551234', type: 'home' })
formService.addItem('phones', 0)
formService.apply('phones.0', { number: '8881115678', type: 'work' })
```

```console
// initialized
state: {
  phones: [
    { number: '8888888888', type: 'fax' },
  ],
}

// added first item (added to the end)
state: {
  phones: [
    { number: '8888888888', type: 'fax' },
    { number: '', type: '' },
  ],
}

// modified newly-created item
state: {
  phones: [
    { number: '8888888888', type: 'fax' },
    { number: '8005551234', type: 'home' },
  ],
}

// added second item (inserted in front)
state: {
  phones: [
    { number: '', type: '' },
    { number: '8888888888', type: 'fax' },
    { number: '8005551234', type: 'home' },
  ],
}

// modified second item (inserted in front)
state: {
  phones: [
    { number: '8881115678', type: 'work' },
    { number: '8888888888', type: 'fax' },
    { number: '8005551234', type: 'home' },
  ],
}
```

_NOTE_: There is currently no functionality for bulk-adding items.

To remove an item, use the `removeItem(name, index)` method. It works just like `addItem()`, except for removing items.

## Utility Functions _Coming Soon_

The `FormService` is a very "meta" framework for handling form state where the very shape of the input model's object can provide many ways of creating rules for facilitating, manipulating, and governing form state.

There are a few useful helper functions that will eventually be exposed in this package's interface, and they will be documented here.

## Selector Properties

### Flags
- `clipErrors`: flag for object-type keys which will clip its corresponding key in the `errors` schema to a single value instead of an object of values
- `clipPristine`: flag for object-type keys which will clip its corresponding key in the `pristine` schema to a single value instead of an object of values
- `ignorePristine`: removes pristine status from a key

### Strings
- `alias` _Coming Soon_: overrides the key name when copying the input model's value over

### Functions
- `addItem`: function that generates a new array item for that selector
- `format`: transforms the affect's key's value coming from the input model
- `unformat`: transforms the affect's key's value coming from the state
- `validators`: an array of validators that to invoke against the value of its corresponding key's value whenever its value, or a descendent-key's value is modified

### Objects
- `children`: used to define child-selectors
